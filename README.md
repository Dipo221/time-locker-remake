# Time Locker Remake

**▶ 開始玩：https://dipo221.github.io/time-locker-remake/**

《TIME LOCKER》（Sotaro Otsuka，2016）的同人復刻版，用瀏覽器就能玩，手機和電腦都可以。原作已從商店下架，這是一份出於喜愛的致敬作品。

> A fan remake of TIME LOCKER (Sotaro Otsuka, 2016), playable in the browser.
> Not affiliated with or endorsed by the original's creator.

## 怎麼玩

- **拖曳**移動角色，角色會自動射擊。
- **時間跟著你動**：手指停下來，整個世界就靜止；移動得越快，時間走得越快。
- **黑暗從背後追來**，而且不會停。被追上就結束。
- 碰到任何敵人或敵人的子彈都會死。
- 打掉**藍色**的敵人會掉武器，武器可以無限疊加；**綠色**的敵人和障礙物會掉金幣。
- 大廳可以自由走動：走去碰其他角色就會換成它；靠在機台上停一下就會購買（POD 抽角色、隨機武器、把角色永久留下）。
- 往上走過 START 線，遊戲就從你站的地方直接開始。

手機上建議用瀏覽器的「加到主畫面」，全螢幕玩起來更順，存檔也比較不容易被清掉。

## 存檔

紀錄只存在你自己的瀏覽器裡，不會上傳到任何地方。換手機、換瀏覽器或清除瀏覽資料，紀錄就不會跟著過去。

要搬移紀錄：在大廳下方按 **SAVE** → **COPY SAVE CODE**，把存檔碼貼到新的地方 → **LOAD SAVE CODE**。

## 開發

需要 Node.js。

```bash
npm install
npm run dev      # 本機開發伺服器
npm test         # 測試
npm run build    # 輸出到 dist/
```

推送到 `main` 後，GitHub Actions 會先跑測試，通過才自動發布到 GitHub Pages。

## 聲明

這是非官方的同人作品，與原作者及原作發行方無關。《TIME LOCKER》的名稱、角色與設計歸其原權利人所有。程式碼為全新撰寫，沒有使用原作的任何素材。
