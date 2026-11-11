import './style.css';
// The small entry stays independent of the engine bundle so a failed engine
// import leaves an actionable screen rather than an empty root.
void import('./main').catch(() => {
  const root = document.getElementById('root')!;
  root.replaceChildren();
  const message = document.createElement('p');
  message.textContent = 'Application resources could not be loaded. Check your network connection. If the problem persists, contact the maintainer who provided this tool.';
  const retry = document.createElement('button');
  retry.textContent = 'Reload';
  retry.onclick = () => location.reload();
  root.append(message, retry);
});
