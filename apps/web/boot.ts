import './style.css';
// The small entry stays independent of the engine bundle so a failed engine
// import leaves an actionable screen rather than an empty root.
void import('./main').catch(() => {
  const root = document.getElementById('root')!;
  root.replaceChildren();
  const message = document.createElement('p');
  message.textContent = '程序资源加载失败。请检查网络连接；若仍失败，请联系提供本工具的维护者。';
  const retry = document.createElement('button');
  retry.textContent = '重新加载';
  retry.onclick = () => location.reload();
  root.append(message, retry);
});
