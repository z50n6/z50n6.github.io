/* global window, document */
/**
 * 悬浮按钮：回到顶部 / 回到底部
 *
 * 两个按钮常驻显示，处于边界时给对应按钮加 .is-disabled（置灰、不可点），
 * 读者不用去试就知道已经到头/到底了。
 *
 * 关于「回到底部」：文章里的图片是懒加载的，滚动过程中图片陆续载入会把页面
 * 撑高，所以**不能只调用一次 scrollTo(scrollHeight)**（实测只滚到约 2/3 处）。
 * 处理办法是分几次逼近，并且在每次逼近前检查「本次动作是否已被取消」——
 * 否则用户点了「回到顶部」时，还在跑的重试会把他又拽回下面。
 *
 * 放在站点 scripts/ 下（而非主题内），主题升级不会覆盖。
 */
'use strict';

(function () {
  var root = document.getElementById('scroll-nav');
  if (!root) return;

  var upBtn = root.querySelector('[data-scroll="top"]');
  var downBtn = root.querySelector('[data-scroll="bottom"]');
  if (!upBtn || !downBtn) return;

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function docHeight() {
    return Math.max(
      document.body ? document.body.scrollHeight : 0,
      document.documentElement.scrollHeight
    );
  }

  function viewHeight() {
    return window.innerHeight || document.documentElement.clientHeight;
  }

  function currentY() {
    return window.pageYOffset || document.documentElement.scrollTop || 0;
  }

  // 可滚动空间不足一屏时这组按钮没有意义
  function hasScrollableArea() {
    return docHeight() - viewHeight() > 120;
  }

  function nativeSmooth() {
    return !reduceMotion && 'scrollBehavior' in document.documentElement.style;
  }

  // 手写补间（不支持 scroll-behavior 时用）
  function tweenTo(target, token) {
    var startY = currentY();
    var dist = target - startY;
    var start = null;
    var DURATION = 420;

    function step(ts) {
      if (token.cancelled) return;
      if (start === null) start = ts;
      var p = Math.min((ts - start) / DURATION, 1);
      var eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      window.scrollTo(0, startY + dist * eased);
      if (p < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  // 每次动作带一个 token；发起新动作时把旧的标记为作废
  var activeToken = { cancelled: false };

  function newAction() {
    activeToken.cancelled = true;
    activeToken = { cancelled: false };
    return activeToken;
  }

  function goTo(target, token) {
    if (token.cancelled || reduceMotion) {
      window.scrollTo(0, target);
      return;
    }
    if (nativeSmooth()) {
      window.scrollTo({ top: target, behavior: 'smooth' });
    } else {
      tweenTo(target, token);
    }
  }

  /**
   * 等滚动真正停下来再回调。
   *
   * 不能用一个固定的 setTimeout 猜时长：Chrome 的平滑滚动动画会随距离变长，
   * 若在动画中途就读位置，会误判成「到不了底」而提前收手
   * （实测固定 560ms 只能滚到约 90%）。
   * 优先用 scrollend 事件；不支持时退回「位置连续两次不变」判定。
   */
  function whenScrollSettled(done, timeout) {
    var settled = false;
    var timer = 0;
    var poll = 0;

    function finish() {
      if (settled) return;
      settled = true;
      window.removeEventListener('scrollend', finish);
      if (timer) window.clearTimeout(timer);
      if (poll) window.clearInterval(poll);
      done();
    }

    if ('onscrollend' in window) {
      window.addEventListener('scrollend', finish, { once: true });
      // 兜底：万一 scrollend 没触发
      timer = window.setTimeout(finish, (timeout || 2000) + 600);
      return;
    }

    // 回退：轮询位置，连续两次不变即认为停稳
    var lastY = currentY();
    var still = 0;
    var elapsed = 0;
    var STEP = 80;
    var total = timeout || 2000;
    poll = window.setInterval(function () {
      elapsed += STEP;
      var y = currentY();
      if (Math.abs(y - lastY) < 1) {
        still++;
        if (still >= 2) finish();
      } else {
        still = 0;
        lastY = y;
      }
      if (elapsed >= total) finish();
    }, STEP);
  }

  function goTop() {
    var token = newAction();
    goTo(0, token);
    whenScrollSettled(function () { if (!token.cancelled) update(); });
  }

  /**
   * 回到底部：分几次逼近，应对懒加载把页面撑高的情况。
   * 最多 5 次；如果位置已经不再变化（滚不动了）就提前收手，
   * 避免和懒加载互相拉扯。
   */
  function goBottom() {
    var token = newAction();
    var tries = 0;

    // 长页面（文章里上百张图，文档高度可达数万 px）不适合平滑滚动：
    // Chrome 的平滑动画时长随距离增长，几万 px 要跑好几秒，中途还会被
    // 懒加载不断撑高目标位置（实测只能到 90% 左右）。
    // 「跳到底部」本来就是快速动作，这里用瞬时定位，即时到达；
    // 「回到顶部」距离固定（到 0），仍保留平滑滚动。
    function jump() {
      if (token.cancelled) return;

      window.scrollTo(0, docHeight());
      tries++;

      whenScrollSettled(function () {
        if (token.cancelled) return;

        var y = currentY();
        var maxY = docHeight() - viewHeight();
        var atBottom = y >= maxY - 8;

        if (atBottom || tries >= 6) {
          update();
          return;
        }
        jump();
      }, 400);
    }

    jump();
  }

  function update() {
    if (!hasScrollableArea()) {
      root.hidden = true;
      return;
    }
    root.hidden = false;

    var y = currentY();
    var maxY = docHeight() - viewHeight();

    // 留 4px 容差，避免亚像素误差导致状态抖动
    upBtn.classList.toggle('is-disabled', y <= 4);
    downBtn.classList.toggle('is-disabled', y >= maxY - 4);
  }

  upBtn.addEventListener('click', function () {
    if (upBtn.classList.contains('is-disabled')) return;
    goTop();
  });

  downBtn.addEventListener('click', function () {
    if (downBtn.classList.contains('is-disabled')) return;
    goBottom();
  });

  // 节流，避免滚动时频繁读写布局
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      update();
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  // 图片懒加载会改变页面高度，加载完成后重新判断一次
  window.addEventListener('load', update);

  update();
})();
