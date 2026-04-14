import { getRecords, deleteRecord } from './db.js';

export async function renderGallery() {
  const container = document.getElementById('gallery-grid');
  if(!container) return;
  
  container.textContent = '';
  const pLoad = document.createElement('p');
  pLoad.textContent = '読み込み中...';
  container.appendChild(pLoad);
  try {
    const records = await getRecords();
    
    const infoEl = document.getElementById('gallery-storage-info');
    if (infoEl) {
      infoEl.innerHTML = '';
      const estimatedMB = (records.length * 0.5).toFixed(1);
      if (records.length > 50) {
        const span = document.createElement('span');
        span.style.color = 'red';
        span.textContent = `⚠️ 容量警告: 現在 ${records.length} 枚（推定 ${estimatedMB} MB）の画像が保存されています。`;
        const br = document.createElement('br');
        const textNode = document.createTextNode('iOSなどの一部端末では、これ以上増えると古いデータから自動消去される可能性があります。不要な画像を削除してください。');
        infoEl.appendChild(span);
        infoEl.appendChild(br);
        infoEl.appendChild(textNode);
      } else {
        infoEl.textContent = `保存枚数: ${records.length} 枚 (推定 ${estimatedMB} MB)`;
      }
    }
    
    // ソート (新しい順)
    records.sort((a,b) => b.date.localeCompare(a.date));
    
    if(records.length === 0) {
      container.textContent = '';
      const pEmpty = document.createElement('p');
      pEmpty.textContent = 'まだ記録がありません。今日から描き始めましょう！';
      container.appendChild(pEmpty);
      return;
    }

    container.innerHTML = '';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
    container.style.gap = '20px';

    records.forEach(rec => {
      const card = document.createElement('div');
      card.className = 'brutal-box gallery-card';
      card.style.padding = '10px';
      // ネオブルータリズム: カードごとにランダムな傾き
      const angle = (Math.random() - 0.5) * 4; // -2 to +2 deg
      const tx = (Math.random() - 0.5) * 6;
      card.style.transform = `rotate(${angle.toFixed(1)}deg) translateX(${tx.toFixed(1)}px)`;
      card.style.transition = 'transform 0.15s';
      card.addEventListener('mouseover', () => { card.style.transform = `rotate(0deg) scale(1.03)`; });
      card.addEventListener('mouseout', () => { card.style.transform = `rotate(${angle.toFixed(1)}deg) translateX(${tx.toFixed(1)}px)`; });
      
      const img = document.createElement('img');
      const objUrl = URL.createObjectURL(rec.imageBlob);
      img.src = objUrl;
      img.onload = () => URL.revokeObjectURL(objUrl);
      img.style.width = '100%';
      img.style.height = 'auto';
      img.style.border = '2px solid #000';
      img.style.aspectRatio = '4/3';
      img.style.objectFit = 'cover';
      
      const title = document.createElement('h4');
      title.textContent = `${rec.date} : ${rec.theme}`;
      title.style.margin = '10px 0 5px 0';
      
      const delBtn = document.createElement('button');
      delBtn.className = 'brutal-btn accent-red';
      delBtn.style.padding = '5px 10px';
      delBtn.style.fontSize = '0.8rem';
      delBtn.textContent = '削除';
      delBtn.onclick = async () => {
        if(confirm(`${rec.date} の記録を本当に削除しますか？`)) {
          await deleteRecord(rec.date);
          await renderGallery();
        }
      };
      
      card.appendChild(img);
      card.appendChild(title);
      card.appendChild(delBtn);
      container.appendChild(card);
    });

  } catch(e) {
    container.textContent = '';
    const pErr = document.createElement('p');
    pErr.textContent = 'エラーが発生しました。';
    container.appendChild(pErr);
    console.error(e);
  }
}
