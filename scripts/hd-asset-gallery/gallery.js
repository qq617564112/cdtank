(() => {
  var data = JSON.parse(document.getElementById('gallery-data').textContent);
  var assets = data.assets;
  var group = document.getElementById('group');
  var search = document.getElementById('search');
  var status = document.getElementById('status');
  var list = document.getElementById('assets');
  var zoom = document.getElementById('zoom');
  var zoomPair = document.getElementById('zoom-pair');
  var pageSize = 24;
  var page = 0;
  var filtered = [];

  function element(tag, text, className) {
    var node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function groupName(value) {
    var names = {pets: '宠物', tanks: '坦克', art: '美术与特效', ui: '界面资源', loading: '加载插画独立图层'};
    return names[value] || `地图 ${value.slice(4)}`;
  }

  function dimensions(asset) {
    var original = asset.size.join(' × ');
    return asset.hdSize ? `${original} → ${asset.hdSize.join(' × ')}` : `${original} · 待处理`;
  }

  function figure(url, label, source, lazy) {
    var node = element('figure');
    node.append(element('figcaption', label));
    var area = element('div', undefined, 'image-area');
    if (url) {
      var image = document.createElement('img');
      image.src = url;
      image.alt = `${label}：${source}`;
      image.decoding = 'async';
      if (lazy) image.loading = 'lazy';
      area.append(image);
    } else {
      area.append(element('span', '待处理', 'muted'));
    }
    node.append(area);
    return node;
  }

  function openAsset(asset) {
    document.getElementById('zoom-title').textContent = asset.source;
    document.getElementById('zoom-size').textContent = dimensions(asset);
    document.getElementById('zoom-mode').value = 'fit';
    zoomPair.classList.remove('pixels');
    zoomPair.replaceChildren(figure(asset.original, '原图', asset.source, false),
      figure(asset.hd, '高清图', asset.source, false));
    zoom.showModal();
  }

  function render() {
    var pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.max(0, Math.min(page, pages - 1));
    list.replaceChildren();
    filtered.slice(page * pageSize, (page + 1) * pageSize).forEach(asset => {
      var item = element('li', undefined, 'asset');
      item.append(element('h2', asset.source));
      var pair = element('div', undefined, 'pair');
      pair.append(figure(asset.original, '原图', asset.source, true),
        figure(asset.hd, '高清图', asset.source, true));
      item.append(pair);
      var footer = element('footer');
      footer.append(element('span', dimensions(asset), 'dimensions'));
      var button = element('button', '放大对照');
      button.type = 'button';
      button.addEventListener('click', () => openAsset(asset));
      footer.append(button);
      item.append(footer);
      list.append(item);
    });
    var completed = filtered.filter(asset => asset.hd).length;
    document.getElementById('results').textContent = `${filtered.length.toLocaleString()} 项 · 已完成 ${completed.toLocaleString()} 项`;
    document.getElementById('page').textContent = `${page + 1} / ${pages}`;
    document.getElementById('previous').disabled = page === 0;
    document.getElementById('next').disabled = page === pages - 1;
    document.getElementById('empty').hidden = filtered.length !== 0;
  }

  function filter() {
    var query = search.value.trim().toLowerCase();
    filtered = assets.filter(asset => (!group.value || asset.groups.includes(group.value))
      && (!query || asset.source.toLowerCase().includes(query))
      && (status.value === 'all' || (status.value === 'complete' ? asset.hd : !asset.hd)));
    page = 0;
    render();
  }

  var groups = [...new Set(assets.flatMap(asset => asset.groups))];
  for (var value of groups) {
    var members = assets.filter(asset => asset.groups.includes(value));
    var complete = members.filter(asset => asset.hd).length;
    var option = element('option', `${groupName(value)} (${complete}/${members.length})`);
    option.value = value;
    group.append(option);
  }
  var base = assets.filter(asset => !asset.layer);
  var layers = assets.filter(asset => asset.layer);
  document.getElementById('progress').textContent = `基础资源 ${base.filter(asset => asset.hd).length.toLocaleString()} / ${base.length.toLocaleString()} · 加载插画图层 ${layers.filter(asset => asset.hd).length} / ${layers.length}`;
  document.getElementById('updated').textContent = `资源快照：${new Date(data.updated).toLocaleString()} · 每组安装完成后更新，刷新页面查看最新进度。`;
  var previewList = document.getElementById('preview-list');
  for (var preview of data.previews) {
    var item = element('li');
    var link = element('a', preview.name);
    link.href = preview.url;
    link.target = '_blank';
    item.append(link);
    previewList.append(item);
  }
  document.getElementById('previews').hidden = data.previews.length === 0;
  document.getElementById('filters').addEventListener('submit', event => event.preventDefault());
  group.addEventListener('change', filter);
  status.addEventListener('change', filter);
  search.addEventListener('input', filter);
  document.getElementById('previous').addEventListener('click', () => { page--; render(); });
  document.getElementById('next').addEventListener('click', () => { page++; render(); });
  document.getElementById('reload').addEventListener('click', () => location.reload());
  document.getElementById('close').addEventListener('click', () => zoom.close());
  zoom.addEventListener('close', () => zoomPair.replaceChildren());
  document.getElementById('zoom-mode').addEventListener('change', event => {
    zoomPair.classList.toggle('pixels', event.target.value === 'pixels');
  });
  filter();
})();
