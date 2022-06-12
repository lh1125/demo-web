function throttle(fn, wait) {
  let lastTime = 0;
  let timer;
  return function (...args) {
    // 时间戳+演示器，分别触发第一次和最后一次回调
    function run() {
      const now = new Date().valueOf();
      if (now - lastTime > wait) {
        fn.apply(this, args);
        lastTime = now;
      }
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(run, wait);
    run();
  }
}

class VirtualScroller {
  constructor({
    element,
    height,
    rowHeight,
    pageSize,
    buffer,
    renderItem,
    loadMore
  }) {
    if (typeof element === 'string') {
      this.scroller = document.querySelector(element);
    } else if (element instanceof HTMLElement) {
      this.scroller = element;
    }

    if (!this.scroller) {
      throw new Error('Invalid element');
    }

    if (!height || (typeof height !== 'number' && typeof height !== 'string')) {
      throw new Error('invalid height value');
    }

    if (!rowHeight || typeof rowHeight !== 'number') {
      throw new Error('rowHeight should be a number');
    }

    if (typeof renderItem !== 'function') {
      throw new Error('renderItem is not a function');
    }

    if (typeof loadMore !== 'function') {
      throw new Error('renderItem is not a function');
    }

    // set props
    this.height = height;
    this.rowHeight = rowHeight;
    // 每页渲染条数
    this.pageSize = typeof pageSize === 'number' && pageSize > 0 ? pageSize : 50;
    // 可视区以外缓冲区数据条数
    this.buffer = typeof buffer === 'number' && buffer >= 0 ? buffer : 10;
    this.renderItem = renderItem;
    this.loadMore = loadMore;
    this.data = [];

    // create content box
    const contentBox = document.createElement('div');
    this.contentBox = contentBox;
    this.scroller.append(contentBox);

    this.scroller.style.height = typeof height === 'number' ? height + 'px' : height;

    this._loadInitData();
    this.scroller.addEventListener('scroll', throttle(this._handleScroll, 150));
  }
  // 顶部边界索引
  _topHiddenCount = 0;
  _bottomHiddenCount = 0;
  _scrollTop = 0;
  // 动态设置内边距为了撑开父盒子，可滚动+滚动条逼真
  _paddingTop = 0;
  _paddingBottom = 0;
  _lastVisibleItemIndex = 0;

  _loadInitData() {
    const scrollerRect = this.scroller.getBoundingClientRect();
    // 占满容器需最少条数据
    const minCount = Math.ceil(scrollerRect.height / this.rowHeight);
    // 计算需要渲染几页数据
    const page = Math.ceil(minCount / this.pageSize);
    const newData = this.loadMore(page * this.pageSize);
    this.data.push(...newData);
    this._renderNewData(newData);
  }

  // 渲染dom（每条）
  _renderRow(item) {
    const rowContent = this.renderItem(item);
    const row = document.createElement('div');
    row.dataset.index = item
    row.style.height = this.rowHeight + 'px';
    row.appendChild(rowContent)
    return row;
  }

  // 渲染新数据
  _renderNewData(newData) {
    newData.forEach(item => {
      this.contentBox.append(this._renderRow(item));
    });
  }

  // 处理滚动信息
  _handleScroll = (e) => {
    const {
      clientHeight,
      scrollHeight,
      scrollTop
    } = e.target;
    // 是否滚动到底部
    if (scrollHeight - (clientHeight + scrollTop) < 40) {
      console.log('load more');
      const newData = this.loadMore(this.pageSize);
      this.data.push(...newData);
    }
    // 1：朝下  -1：朝上
    const direction = scrollTop > this._scrollTop ? 1 : -1;
    this._toggleTopItems(direction);
    this._toggleBottomItems(direction);
    this._scrollTop = scrollTop;
    console.log({
      direction,
      topHiddenCount: this._topHiddenCount,
      lastVisibleItemIndex: this._lastVisibleItemIndex
    });
  }

  // 切换顶部元素
  _toggleTopItems = (direction) => {
    const {
      scrollTop
    } = this.scroller;
    // 可视区第一个元素的索引
    const firstVisibleItemIndex = Math.floor(scrollTop / this.rowHeight);
    // 顶部边界索引
    const firstExistingItemIndex = Math.max(0, firstVisibleItemIndex - this.buffer);
    const rows = this.contentBox.children;

    // 移除缓冲区以上元素
    if (direction === 1) {
      for (let i = this._topHiddenCount; i < firstExistingItemIndex; i++) {
        if (rows[0]) rows[0].remove();
      }
    }

    // 取出顶部边界以上的元素进行渲染
    // restore hidden top items
    if (direction === -1) {
      for (let i = this._topHiddenCount - 1; i >= firstExistingItemIndex; i--) {
        const item = this.data[i];
        const row = this._renderRow(item);
        this.contentBox.prepend(row);
      }
    }
    // 保存顶部边界索引
    this._topHiddenCount = firstExistingItemIndex;
    this._paddingTop = this._topHiddenCount * this.rowHeight;
    this.contentBox.style.paddingTop = this._paddingTop + 'px';
  }

  // 切换底部元素
  _toggleBottomItems = (direction) => {
    const {
      scrollTop,
      clientHeight
    } = this.scroller;
    // 可视区最后一个元素索引
    const lastVisibleItemIndex = Math.floor((scrollTop + clientHeight) / this.rowHeight);
    // 底部边界索引
    const lastExistingItemIndex = lastVisibleItemIndex + this.buffer;
    this._lastVisibleItemIndex = lastVisibleItemIndex;
    const rows = [...this.contentBox.children];

    // 移除底部边界以外元素
    if (direction === -1) {
      for (let i = lastExistingItemIndex + 1; i <= this.data.length; i++) {
        const row = rows[i - this._topHiddenCount];
        if (row) row.remove();
      }
    }


    // 渲染底部边界以外的元素
    if (direction === 1) {
      for (let i = this._topHiddenCount + rows.length; i <= lastExistingItemIndex; i++) {
        const item = this.data[i];
        if (!item) break;
        const row = this._renderRow(item);
        this.contentBox.append(row);
      }
    }
    //根据保存的data 计算底部隐藏多少条数据
    this._bottomHiddenCount = Math.max(0, this.data.length - (this._topHiddenCount + this.contentBox.children.length) - this.buffer);
    this._paddingBottom = this._bottomHiddenCount * this.rowHeight;
    this.contentBox.style.paddingBottom = this._paddingBottom + 'px';
  }
}