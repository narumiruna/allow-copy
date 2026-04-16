## GOTCHA
- `activeTab` 只提供暫時授權；若要記住某站並在之後自動重新注入，啟用站點時還要請求該 hostname 的 optional host permission。
- `chrome.permissions.request()` 可能讓 action popup 在權限提示時失去焦點並被銷毀；權限核准後的 enabled 持久化要有 background 補償，不要只依賴 popup 繼續執行。

## TASTE
- 對網站權限維持 privacy-first：不要加全域 `host_permissions`，改用每站點、啟用時才請求的 optional host permission。
