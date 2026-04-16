## GOTCHA
- `activeTab` 只提供暫時授權；若要記住某站並在之後自動重新注入，啟用站點時還要請求該 hostname 的 optional host permission。

## TASTE
- 對網站權限維持 privacy-first：不要加全域 `host_permissions`，改用每站點、啟用時才請求的 optional host permission。
