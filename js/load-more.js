/* global window, document */
/**
 * 首页「加载更多」
 *
 * 首页只渲染前 N 篇（_config.yml 的 index_generator.per_page），
 * 点击按钮后逐页拉取 page/2、page/3 …，把其中的 .post-item 追加到
 * **.post-list** 末尾。
 *
 * 为什么必须有一个显式的 .post-list 容器，而不是「最后一个 .post-item 的父节点」：
 * 页面结构是
 *     .content-container
 *       ├─ .post-item ×N
 *       └─ .pagination-container   ← 「加载更多」按钮
 * 两者的父节点是同一个。若往那个父节点追加，新文章会落到按钮**后面**，
 * 按钮就被挤到列表中间（这就是当初的 bug）。
 * 所以模板里给文章加了一层 .post-list，脚本首次运行时把已有文章搬进去，
 * 之后只往这个容器追加。
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

    var listEl = document.querySelector('.post-list');
    var doneEl = wrap.querySelector('.load-more-done');
    var textEl = wrap.querySelector('.load-more-text');
    var loading = false;

    if (listEl) {
      // 把模板里已渲染的文章搬进 .post-list（它们本来就在里面，
      // 这里只处理「.post-list 之外还散落着文章」的兼容情况）
      var strays = document.querySelectorAll('.post-item');
      Array.prototype.forEach.call(strays, function (el) {
        if (el.parentNode !== listEl) listEl.appendChild(el);
      });
    } else {
      // 找不到容器就不做追加，避免又把按钮挤到中间
      if (window.console) console.warn('[load-more] 未找到 .post-list，已跳过');
      return;
    }

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

    function fail() {
      setLoading(false);
      if (textEl) textEl.textContent = '加载失败，点击重试';
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

          // 追加到 .post-list（而不是按钮所在容器）
          var frag = document.createDocumentFragment();
          Array.prototype.forEach.call(items, function (el) {
            frag.appendChild(document.importNode(el, true));
          });
          listEl.appendChild(frag);

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

          if (!nextNext || page >= totalPages()) finish();
        })
        .catch(function (err) {
          fail();
          if (window.console) console.warn('[load-more] 加载失败:', err);
        });
    }

    btn.addEventListener('click', loadNext);

    if (!btn.getAttribute('data-next')) finish();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
