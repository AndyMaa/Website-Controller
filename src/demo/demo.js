let unread = 0;
document.querySelector('#send').addEventListener('click', () => {
  const button = document.querySelector('#send'); button.disabled = true; button.textContent = '消息将在 3 秒后到达…';
  setTimeout(() => { unread++; const badge = document.querySelector('#unread'); badge.textContent = String(unread); badge.dataset.unreadCount = String(unread); document.querySelector('#latest').textContent = `演示客户 ${unread}：你好，有一个新的设计需求，方便沟通一下吗？`; document.title = `(${unread}) 提醒演示 · 本地测试`; button.disabled = false; button.textContent = '3 秒后再收到一条演示消息'; }, 3000);
});
document.querySelector('#read').addEventListener('click', () => { unread = 0; const badge = document.querySelector('#unread'); badge.textContent = '0'; badge.dataset.unreadCount = '0'; document.title = '提醒演示 · 本地测试'; });
