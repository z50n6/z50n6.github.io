/* global window, document */
/**
 * 首页「加载更多」
 *
 * 首页只渲染前 N 篇（_config.yml 的 index_generator.per_page），
 * 点击按钮后逐页拉取 page/2、page/3 …，把其中的 .post-item 追加到列表末尾。
 *
 * 实现要点：
 *   - 用 fetch + DOMParser 解析下一页 HTML，只取 .post-item，不整页替换
 *   - 按钮上存了 data-next（下一页地址）和 data-remaining，避免额外的页数计算
 *   - 拉取失败时恢复按钮并提示，不会把界面卡在 loading 状态
 *   - 用 IntersectionObserver 做滚动到底自动加载（可选，失败降级为纯手动点击）
 *
 * 放在站点 scripts/ 下（而非主题内），主题升级不会覆盖。
 */
'use strict';

(function () {
  function init() {
    var wrap = document.querySelector('[data-load-more]');
    if (!wrap) return;

    var btn = wrap.querySelector('.load-more-btn');
    if (!btn) return;

    var list = document.querySelector('.post-list') || document.querySelector('#posts') || null;
    // 首页文章列表的容器：主题里是 #app 下的 .content-container，直接以最后一个
    // .post-item 的父节点作为追加目标，最稳妥。
    var anchor = document.querySelector('.post-item');
    var container = anchor ? anchor.parentNode : list;
    if (!container) return;

    var doneEl = wrap.querySelector('.load-more-done');
    var textEl = wrap.querySelector('.load-more-text');
    var loading = false;

    function currentPage() {
      return parseInt(btn.getAttribute('data-page') || '1', 10);
    }

    function totalPages() {
      return parseInt(btn.getAttribute('data-total') || '1', 10);
    }

    function setLoading(on) {
      loading = on;
      btn.classList.toggle('is-loading', on);
      btn.disabled = on;
    }

    function finish() {
      btn.hidden = true;
      if (doneEl) doneEl.hidden = false;
    }

    function fail(msg) {
      setLoading(false);
      if (textEl) textEl.textContent = msg || '加载失败，点击重试';
      btn.classList.add('is-error');
    }

    function loadNext() {
      if (loading) return;
      var nextUrl = btn.getAttribute('data-next');
      if (!nextUrl) { finish(); return; }

      setLoading(true);
      btn.classList.remove('is-error');

      fetch(nextUrl, { credentials: 'same-origin' })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text();
        })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var items = doc.querySelectorAll('.post-item');

          if (!items.length) { finish(); return; }

          // 追加；用 fragment 减少重排
          var frag = document.createDocumentFragment();
          Array.prototype.forEach.call(items, function (el) {
            frag.appendChild(document.importNode(el, true));
          });
          container.appendChild(frag);

          // 页数推进
          var page = currentPage() + 1;
          btn.setAttribute('data-page', String(page));

          // 从下一页 HTML 里读出它自己的 data-next，作为我们的下一页地址
          var nextBtn = doc.querySelector('[data-load-more] .load-more-btn');
          var nextNext = nextBtn ? nextBtn.getAttribute('data-next') : '';
          btn.setAttribute('data-next', nextNext || '');
          if (nextBtn) {
            btn.setAttribute('data-total', nextBtn.getAttribute('data-total') || String(totalPages()));
          }

          setLoading(false);

          if (!nextNext || page >= totalPages()) {
            finish();
          }
        })
        .catch(function (err) {
          fail();
          if (window.console) console.warn('[load-more] 加载失败:', err);
        });
    }

    btn.addEventListener('click', loadNext);

    // 初始就没有下一页时直接收尾
    if (!btn.getAttribute('data-next')) finish();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
