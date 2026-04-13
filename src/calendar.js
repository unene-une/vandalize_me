import { getRecords } from './db.js';

export async function renderCalendar() {
  const container = document.getElementById('calendar-grid');
  if(!container) return;
  
  try {
    const records = await getRecords();
    const recordsMap = {};
    records.forEach(r => recordsMap[r.date] = r);
    
    // シンプルな当月カレンダー表示（月切り替えは将来拡張）
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    container.innerHTML = '';
    
    const title = document.createElement('h3');
    title.textContent = `${year}年 ${month+1}月`;
    container.appendChild(title);
    
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
    grid.style.gap = '10px';
    grid.style.marginTop = '10px';
    
    // 曜日
    ['日','月','火','水','木','金','土'].forEach(day => {
      const dEl = document.createElement('div');
      dEl.style.textAlign = 'center';
      dEl.style.fontWeight = 'bold';
      dEl.textContent = day;
      grid.appendChild(dEl);
    });
    
    // パディング
    for(let i=0; i<firstDay; i++) {
      grid.appendChild(document.createElement('div'));
    }
    
    for(let d=1; d<=daysInMonth; d++) {
      const dbDate = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const hasRecord = !!recordsMap[dbDate];
      
      const dayCell = document.createElement('div');
      if (hasRecord) {
        dayCell.className = 'cal-day';
        dayCell.dataset.date = dbDate;
        dayCell.style.cssText = 'aspect-ratio:1; display:flex; align-items:center; justify-content:center; flex-direction:column; background-color: var(--neon-green); border: var(--border-thick); box-shadow: var(--shadow-sm); cursor: pointer;';
      } else {
        dayCell.style.cssText = 'aspect-ratio:1; display:flex; align-items:center; justify-content:center; flex-direction:column; background-color: transparent; border: 2px dotted #aaa;';
      }
      
      const numSpan = document.createElement('span');
      numSpan.style.fontWeight = '900';
      numSpan.textContent = d;
      dayCell.appendChild(numSpan);
      
      if (hasRecord) {
        const doneSpan = document.createElement('span');
        doneSpan.style.cssText = 'font-size:0.5rem;text-transform:uppercase;';
        doneSpan.textContent = 'DONE';
        dayCell.appendChild(doneSpan);
      }
      grid.appendChild(dayCell);
    }
    
    container.appendChild(grid);
    
    // アタッチポップアップ
    container.querySelectorAll('.cal-day').forEach(el => {
      el.addEventListener('click', () => {
        const dateStr = el.dataset.date;
        const rec = recordsMap[dateStr];
        if (rec) {
          const popup = document.getElementById('calendar-popup');
          const title = document.getElementById('popup-title');
          const img = document.getElementById('popup-img');
          const closeBtn = document.getElementById('popup-close');
          
          if(popup && title && img) {
            title.textContent = `${rec.date} : ${rec.theme}`;
            
            // 古いBlobがあれば解放
            if(img.src && img.src.startsWith('blob:')) {
              URL.revokeObjectURL(img.src);
            }
            img.src = URL.createObjectURL(rec.imageBlob);
            
            if(!popup.open) popup.showModal();
            
            if(closeBtn) {
              closeBtn.onclick = () => {
                popup.close();
                // 閉じる時にメモリ解放
                if(img.src && img.src.startsWith('blob:')) {
                  URL.revokeObjectURL(img.src);
                  img.removeAttribute('src');
                }
              };
            }
          }
        }
      });
    });
    
  } catch(e) {
    container.textContent = '';
    const pErr = document.createElement('p');
    pErr.textContent = 'エラーが発生しました。';
    container.appendChild(pErr);
  }
}
