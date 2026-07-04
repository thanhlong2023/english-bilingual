(function () {
  const PLAYER_COUNT = 2;
  const STEP_SECONDS = 5;
  const POLL_MS = 250;
  const DRIFT_TOLERANCE = 0.45;
  const SEEK_THRESHOLD_PLAYING = 1.2;
  const SEEK_THRESHOLD_PAUSED = 0.45;
  const STORAGE_KEY = "youtube-sync-iframe-input";
  const DELAY_STORAGE_KEY = "youtube-sync-player1-delay";

  const YT_STATE = {
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    CUED: 5,
  };

  const els = {
    form: document.getElementById("sourceForm"),
    input: document.getElementById("videoInput"),
    message: document.getElementById("loadMessage"),
    status: document.getElementById("appStatus"),
    states: [document.getElementById("state0"), document.getElementById("state1")],
    back: document.getElementById("backButton"),
    playPause: document.getElementById("playPauseButton"),
    forward: document.getElementById("forwardButton"),
    sync: document.getElementById("syncButton"),
    delay: document.getElementById("delayInput"),
    speed: document.getElementById("speedSelect"),
  };

  const players = Array(PLAYER_COUNT).fill(null);
  const ready = Array(PLAYER_COUNT).fill(false);
  const loaded = Array(PLAYER_COUNT).fill(false);
  const videoIds = Array(PLAYER_COUNT).fill("");
  const lastTimes = Array(PLAYER_COUNT).fill(0);

  let apiReady = false;
  let pendingIds = null;
  let activeIndex = 0;
  let shouldBePlaying = false;
  let isSyncing = false;
  let syncTimer = 0;
  let playbackRate = 1;
  let player1Delay = 0.5;
  let isApplyingRate = false;
  let rateTimer = 0;

  window.onYouTubeIframeAPIReady = function () {
    apiReady = true;
    setStatus("YouTube API sẵn sàng");

    if (pendingIds) {
      const ids = pendingIds;
      pendingIds = null;
      loadPlayers(ids);
    }
  };

  restoreInput();
  restoreDelay();
  bindEvents();
  loadYouTubeApi();
  setInterval(syncLoop, POLL_MS);

  function bindEvents() {
    els.form.addEventListener("submit", (event) => {
      event.preventDefault();

      const ids = extractVideoIds(els.input.value);
      if (!ids.length) {
        setMessage("Chưa thấy iframe hoặc link YouTube hợp lệ.", "error");
        return;
      }

      while (ids.length < PLAYER_COUNT) {
        ids.push(ids[0]);
      }

      saveInput();

      if (!apiReady) {
        pendingIds = ids;
        setMessage("Đang nạp YouTube API...", "ok");
        setStatus("Đang tải...");
        return;
      }

      loadPlayers(ids);
    });

    els.playPause.addEventListener("click", () => {
      if (shouldBePlaying) {
        pauseBoth();
      } else {
        playBoth();
      }
    });

    els.back.addEventListener("click", () => jumpBy(-STEP_SECONDS));
    els.forward.addEventListener("click", () => jumpBy(STEP_SECONDS));
    els.sync.addEventListener("click", syncNow);
    els.delay.addEventListener("input", () => {
      const value = Number(els.delay.value);
      if (Number.isFinite(value)) {
        setPlayer1Delay(value);
      }
    });
    els.speed.addEventListener("change", () => {
      setPlaybackRate(Number(els.speed.value) || 1);
    });
  }

  function loadYouTubeApi() {
    if (window.YT && window.YT.Player) {
      window.onYouTubeIframeAPIReady();
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = function () {
      setStatus("Lỗi API");
      setMessage("Không nạp được YouTube API.", "error");
    };
    document.head.appendChild(tag);
  }

  function loadPlayers(ids) {
    ids.forEach((id, index) => {
      videoIds[index] = id;
      loaded[index] = true;
      lastTimes[index] = 0;
      setPlayerState(index, "Đang tải");

      if (players[index]) {
        players[index].cueVideoById(id);
        return;
      }

      players[index] = new window.YT.Player(`player${index}`, {
        videoId: id,
        playerVars: {
          controls: 1,
          enablejsapi: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: () => onPlayerReady(index),
          onStateChange: (event) => onPlayerStateChange(index, event.data),
          onPlaybackRateChange: (event) => onPlaybackRateChange(index, event.data),
          onError: (event) => onPlayerError(index, event.data),
        },
      });
    });

    activeIndex = 0;
    shouldBePlaying = false;
    updatePlayButton();
    enableControls(canControl());
    setStatus(canControl() ? "Sẵn sàng" : "Đang tải...");
    setMessage(ids[0] === ids[1] ? "Đã nhận 1 video, tạo 2 player giống nhau." : "Đã nhận 2 video.", "ok");
  }

  function onPlayerReady(index) {
    ready[index] = true;
    players[index].setPlaybackRate(playbackRate);
    setPlayerState(index, "Sẵn sàng");

    if (canControl()) {
      enableControls(true);
      setStatus("Sẵn sàng");
    }
  }

  function onPlayerStateChange(index, state) {
    setPlayerStateFromCode(index, state);

    if (!canControl() || isSyncing) {
      return;
    }

    if (state === YT_STATE.PLAYING) {
      activeIndex = index;
      shouldBePlaying = true;
      updatePlayButton();
      syncOthersTo(getBaseTime(index), index, true);
      setStatus("Đang phát đồng bộ");
      return;
    }

    if (state === YT_STATE.PAUSED && shouldBePlaying) {
      activeIndex = index;
      pauseBoth(index);
      setStatus("Tạm dừng");
      return;
    }

    if (state === YT_STATE.ENDED) {
      pauseBoth(index);
      setStatus("Đã kết thúc");
    }
  }

  function onPlaybackRateChange(index, rate) {
    if (!rate || isApplyingRate) {
      return;
    }

    playbackRate = Number(rate) || 1;
    els.speed.value = String(playbackRate);
    setPlaybackRate(playbackRate, index);
  }

  function onPlayerError(index, code) {
    const blocked = code === 101 || code === 150;
    setPlayerState(index, "Lỗi");
    setMessage(blocked ? `Player ${index + 1}: video chặn nhúng.` : `Player ${index + 1}: lỗi ${code}.`, "error");
  }

  function playBoth(forcedTime) {
    if (!canControl()) {
      return;
    }

    const time = typeof forcedTime === "number" ? forcedTime : getBaseTime(activeIndex);
    runSync(() => {
      players.forEach((player, index) => {
        player.seekTo(getTargetTime(index, time), true);
        player.playVideo();
      });
    }, 700);

    shouldBePlaying = true;
    rememberTimes(time);
    updatePlayButton();
    setStatus("Đang phát đồng bộ");
  }

  function pauseBoth(sourceIndex) {
    if (!hasAnyPlayer()) {
      return;
    }

    runSync(() => {
      players.forEach((player, index) => {
        if (player && ready[index] && index !== sourceIndex) {
          player.pauseVideo();
        }
      });
    }, 500);

    shouldBePlaying = false;
    updatePlayButton();
  }

  function jumpBy(seconds) {
    if (!canControl()) {
      return;
    }

    const target = clampBaseTime(getBaseTime(activeIndex) + seconds);
    if (shouldBePlaying) {
      playBoth(target);
    } else {
      seekBoth(target);
    }
  }

  function syncNow() {
    if (!canControl()) {
      return;
    }

    const time = getBaseTime(activeIndex);
    if (shouldBePlaying) {
      playBoth(time);
    } else {
      seekBoth(time);
    }

    setMessage("Đã đồng bộ lại.", "ok");
  }

  function seekBoth(time) {
    const target = clampBaseTime(time);

    runSync(() => {
      players.forEach((player, index) => player.seekTo(getTargetTime(index, target), true));
    }, 550);

    rememberTimes(target);
  }

  function syncOthersTo(time, sourceIndex, playAfterSeek) {
    const target = clampBaseTime(time);

    runSync(() => {
      players.forEach((player, index) => {
        if (index === sourceIndex) {
          return;
        }

        player.seekTo(getTargetTime(index, target), true);
        if (playAfterSeek) {
          player.playVideo();
        }
      });
    }, 700);

    rememberTimes(target);
  }

  function syncLoop() {
    if (!canControl()) {
      return;
    }

    const times = players.map((_, index) => getBaseTime(index));
    const seekThreshold = shouldBePlaying ? SEEK_THRESHOLD_PLAYING : SEEK_THRESHOLD_PAUSED;
    const seekIndex = !isSyncing ? times.findIndex((time, index) => Math.abs(time - lastTimes[index]) > seekThreshold) : -1;

    if (seekIndex >= 0) {
      activeIndex = seekIndex;
      syncOthersTo(times[seekIndex], seekIndex, shouldBePlaying);
      copyTimes(times);
      return;
    }

    if (!shouldBePlaying || isSyncing) {
      copyTimes(times);
      return;
    }

    const masterTime = times[activeIndex];

    players.forEach((player, index) => {
      if (index === activeIndex) {
        return;
      }

      if (Math.abs(times[index] - masterTime) > DRIFT_TOLERANCE) {
        player.seekTo(getTargetTime(index, masterTime), true);
      }

      const state = player.getPlayerState();
      if (state !== YT_STATE.PLAYING && state !== YT_STATE.BUFFERING) {
        player.playVideo();
      }
    });

    copyTimes(times);
  }

  function setPlaybackRate(rate, sourceIndex) {
    playbackRate = rate;
    els.speed.value = String(rate);

    if (!hasAnyPlayer()) {
      return;
    }

    isApplyingRate = true;
    window.clearTimeout(rateTimer);

    players.forEach((player, index) => {
      if (player && ready[index] && index !== sourceIndex) {
        try {
          player.setPlaybackRate(rate);
        } catch (error) {
          // Some videos may ignore unsupported playback rates.
        }
      }
    });

    rateTimer = window.setTimeout(() => {
      isApplyingRate = false;
    }, 350);
  }

  function setPlayer1Delay(value) {
    player1Delay = Math.max(0, Math.min(Number(value) || 0, 5));
    els.delay.value = String(Math.round(player1Delay * 10) / 10);
    saveDelay();

    if (!canControl()) {
      return;
    }

    const baseTime = getBaseTime(1) || getBaseTime(activeIndex);
    if (shouldBePlaying) {
      playBoth(baseTime);
    } else {
      seekBoth(baseTime);
    }
  }

  function extractVideoIds(value) {
    const text = String(value || "").replace(/&amp;/g, "&");
    const ids = [];

    const youtubeUrls = text.match(/(?:(?:https?:)?\/\/)?(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com|youtu\.be)\/[^\s"'<>]+/gi) || [];
    youtubeUrls.forEach((url) => addVideoId(ids, extractVideoId(url)));

    text.split(/[\s,;]+/).forEach((part) => {
      const token = part.trim().replace(/^["'(<]+|[>"')]+$/g, "");
      if (/^[A-Za-z0-9_-]{11}$/.test(token)) {
        addVideoId(ids, token);
      }
    });

    return ids.slice(0, PLAYER_COUNT);
  }

  function addVideoId(ids, id) {
    if (id && ids.length < PLAYER_COUNT) {
      ids.push(id);
    }
  }

  function extractVideoId(value) {
    const raw = String(value || "").trim();
    const direct = raw.match(/^[A-Za-z0-9_-]{11}$/);
    if (direct) {
      return direct[0];
    }

    const normalized = raw.startsWith("//") ? `https:${raw}` : raw;
    const fallback = normalized.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/|\/v\/)([A-Za-z0-9_-]{11})/);
    if (fallback) {
      return fallback[1];
    }

    try {
      const url = new URL(normalized);
      return url.searchParams.get("v") || "";
    } catch (error) {
      return "";
    }
  }

  function canControl() {
    return ready.every(Boolean) && loaded.every(Boolean);
  }

  function hasAnyPlayer() {
    return players.some((player, index) => player && ready[index]);
  }

  function getTime(index) {
    if (!players[index] || !ready[index]) {
      return 0;
    }

    return Number(players[index].getCurrentTime()) || 0;
  }

  function getBaseTime(index) {
    const time = getTime(index);
    return index === 0 ? time + player1Delay : time;
  }

  function getTargetTime(index, baseTime) {
    const target = index === 0 ? baseTime - player1Delay : baseTime;
    return clampToPlayerDuration(index, target);
  }

  function clampToPlayerDuration(index, time) {
    const player = players[index];
    const duration = player && ready[index] ? Number(player.getDuration()) || 0 : 0;
    const max = duration > 0 ? duration : Number.MAX_SAFE_INTEGER;
    return Math.max(0, Math.min(time, max));
  }

  function clampBaseTime(time) {
    const durations = players
      .map((player, index) => {
        const duration = player && ready[index] ? Number(player.getDuration()) || 0 : 0;
        return index === 0 && duration > 0 ? duration + player1Delay : duration;
      })
      .filter((duration) => duration > 0);
    const max = durations.length ? Math.max(...durations) : Number.MAX_SAFE_INTEGER;
    return Math.max(0, Math.min(time, max));
  }

  function runSync(callback, releaseAfterMs) {
    isSyncing = true;
    window.clearTimeout(syncTimer);

    try {
      callback();
    } finally {
      syncTimer = window.setTimeout(() => {
        isSyncing = false;
      }, releaseAfterMs);
    }
  }

  function setPlayerStateFromCode(index, code) {
    const labels = {
      [YT_STATE.ENDED]: "Kết thúc",
      [YT_STATE.PLAYING]: "Đang phát",
      [YT_STATE.PAUSED]: "Tạm dừng",
      [YT_STATE.BUFFERING]: "Đệm",
      [YT_STATE.CUED]: "Sẵn sàng",
    };

    setPlayerState(index, labels[code] || "Sẵn sàng", code);
  }

  function setPlayerState(index, text, code) {
    els.states[index].textContent = text;
    els.states[index].classList.toggle("playing", code === YT_STATE.PLAYING);
    els.states[index].classList.toggle("paused", code === YT_STATE.PAUSED || text === "Lỗi");
  }

  function updatePlayButton() {
    els.playPause.textContent = shouldBePlaying ? "Dừng" : "Phát";
  }

  function enableControls(enabled) {
    [els.back, els.playPause, els.forward, els.sync, els.delay, els.speed].forEach((control) => {
      control.disabled = !enabled;
    });
  }

  function rememberTimes(time) {
    lastTimes.fill(time);
  }

  function copyTimes(times) {
    times.forEach((time, index) => {
      lastTimes[index] = time;
    });
  }

  function setMessage(text, type) {
    els.message.textContent = text;
    els.message.className = `load-message ${type || ""}`.trim();
  }

  function setStatus(text) {
    els.status.textContent = text;
  }

  function saveInput() {
    try {
      localStorage.setItem(STORAGE_KEY, els.input.value.trim());
    } catch (error) {
      // Ignore localStorage errors.
    }
  }

  function restoreInput() {
    try {
      els.input.value = localStorage.getItem(STORAGE_KEY) || "";
    } catch (error) {
      // Ignore localStorage errors.
    }
  }

  function saveDelay() {
    try {
      localStorage.setItem(DELAY_STORAGE_KEY, String(player1Delay));
    } catch (error) {
      // Ignore localStorage errors.
    }
  }

  function restoreDelay() {
    try {
      const saved = Number(localStorage.getItem(DELAY_STORAGE_KEY));
      if (Number.isFinite(saved) && saved >= 0) {
        player1Delay = Math.min(saved, 5);
      }
      els.delay.value = String(Math.round(player1Delay * 10) / 10);
    } catch (error) {
      els.delay.value = String(player1Delay);
    }
  }
})();
