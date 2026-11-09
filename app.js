/* 세계사 스와이프 트레이너 — 상태·문항 생성 (DOM-free 부분) */
const LS_KEY='segyesa-trainer-v1';
function loadState(){try{return JSON.parse(localStorage.getItem(LS_KEY))||{}}catch(e){return{}}}
function saveState(s){localStorage.setItem(LS_KEY,JSON.stringify(s))}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

/* 문항 id */
const fid=(ch,i)=>ch.id+':f'+i;
const mid=(ch,i)=>ch.id+':m'+i;
const sid=(ch,i)=>ch.id+':s'+i;

/* 사실 카드 -> 객관식 문항 생성. 오답 선지는 같은 풀 우선, 부족하면 같은 챕터, 그래도 부족하면 전체에서 */
function genMC(ch,idx){
  const f=ch.facts[idx];const front=f[0],ans=f[1],note=f[2]||'',pool=f[3];
  const wrongPool=[];
  const push=(arr)=>{for(const o of arr){const v=o[1];if(v!==ans&&!wrongPool.includes(v))wrongPool.push(v)}};
  push(CHAPTERS.flatMap(c=>c.facts.filter(x=>x[3]===pool)));
  if(wrongPool.length<3)push(ch.facts);
  if(wrongPool.length<3)push(CHAPTERS.flatMap(c=>c.facts));
  const distract=shuffle(wrongPool.slice()).slice(0,3);
  const choices=shuffle([ans,...distract]);
  return {id:fid(ch,idx),type:'mc',q:'다음 설명에 해당하는 것은?\n'+front,c:choices,ans:choices.indexOf(ans),
    exp:(note?note+' · ':'')+'정답: '+ans,src:'자체 제작 연습문제 (기출 아님)'};
}
function authoredMC(ch,idx){
  const m=ch.mc[idx];
  return {id:mid(ch,idx),type:'mc',q:m.q,c:m.c.slice(),ans:m.ans,exp:m.exp,src:'자체 제작 연습문제 (기출 아님)'};
}
function revealQ(ch,idx){
  const s=ch.selfcheck[idx];
  return {id:sid(ch,idx),type:'reveal',q:s[0],a:s[1],src:'셀프 체크 (교재 원문)'};
}
/* 챕터 퀴즈 세션 구성: authored mc 전부 + 생성 mc(최대 8) + 셀프체크 */
function buildQuiz(ch){
  const qs=ch.mc.map((_,i)=>authoredMC(ch,i));
  const elig=ch.facts.map((f,i)=>i).filter(i=>!ch.facts[i][4]);
  const genIdx=ch.noGen?[]:shuffle(elig).slice(0,Math.min(8,elig.length));
  genIdx.forEach(i=>qs.push(genMC(ch,i)));
  ch.selfcheck.forEach((_,i)=>qs.push(revealQ(ch,i)));
  return shuffle(qs);
}
/* 오답 복원 */
function reviveWrong(entry){
  const ch=CHAPTERS.find(c=>c.id===entry.chId);if(!ch)return null;
  if(entry.kind==='f')return genMC(ch,entry.idx);
  if(entry.kind==='m')return authoredMC(ch,entry.idx);
  if(entry.kind==='s')return revealQ(ch,entry.idx);
  return null;
}
if(typeof module!=='undefined'){module.exports={genMC,authoredMC,revealQ,buildQuiz,reviveWrong,shuffle,fid,mid,sid,LS_KEY}}

if(typeof document!=='undefined'){
/* ================= UI ================= */
let S=loadState();S.known=S.known||{};S.wrong=S.wrong||{};S.quiz=S.quiz||{};
const main=()=>document.getElementById('main');
const setTitle=(t,back)=>{document.getElementById('topTitle').textContent=t;document.getElementById('backBtn').classList.toggle('hidden',!back)};
document.getElementById('backBtn').onclick=()=>goHome();
document.getElementById('wrongBtn').onclick=()=>goWrong();
function persist(){saveState(S);updateWrongBadge()}
function wrongCount(){return Object.keys(S.wrong).length}
function updateWrongBadge(){const b=document.getElementById('wrongBadge');const n=wrongCount();b.textContent=n;b.classList.toggle('hidden',n===0)}
function parseQid(id){const[chId,rest]=[id.slice(0,id.indexOf(':')),id.slice(id.indexOf(':')+1)];return{chId,kind:rest[0],idx:parseInt(rest.slice(1),10)}}
function markWrong(id){const p=parseQid(id);S.wrong[id]={chId:p.chId,kind:p.kind,idx:p.idx,streak:0};persist()}
function markRight(id){const w=S.wrong[id];if(!w)return;w.streak++;if(w.streak>=2)delete S.wrong[id];persist()}

/* ---------- 홈 ---------- */
function goHome(){
  setTitle('세계사 스와이프 트레이너',false);
  const el=main();el.innerHTML='';
  const notice=document.createElement('div');notice.className='notice';
  notice.innerHTML='2027학년도 수능 세계사 8시간 총정리 기반 학습 앱. 연습문제는 <b>이 앱이 자체 제작한 문항</b>으로 실제 기출이 아닙니다. 실제 기출 원문은 마지막 챕터의 공식 링크에서 확인하세요.';
  el.appendChild(notice);
  const tCh=CHAPTERS.filter(c=>!c.linkOnly);
  const totalCards=tCh.reduce((a,c)=>a+c.facts.length+c.hints.length,0);
  const knownCards=tCh.reduce((a,c)=>a+c.facts.filter((_,i)=>S.known[fid(c,i)]).length+c.hints.filter((_,i)=>S.known[c.id+':h'+i]).length,0);
  const pctAll=totalCards?Math.round(knownCards*100/totalCards):0;
  const ov=document.createElement('div');ov.className='overview';
  ov.innerHTML=`<div class="ov-label">전체 학습 진행률</div>
    <div class="ov-row"><span class="ov-pct">${pctAll}%</span><span class="ov-sub">카드 ${knownCards}/${totalCards}장 암기</span></div>
    <div class="progress"><div style="width:${pctAll}%"></div></div>
    <div class="ov-stats">
      <div class="ov-stat"><b>${tCh.length}</b>챕터</div>
      <div class="ov-stat"><b>${knownCards}</b>암기한 카드</div>
      <div class="ov-stat"><b>${wrongCount()}</b>오답 남음</div>
    </div>`;
  el.appendChild(ov);
  const list=document.createElement('div');list.className='card-list';
  const ACCENTS=['#64748B','#4F46E5','#0E9C87','#D97706','#DC2626','#7C3AED','#2563EB','#475569'];
  CHAPTERS.forEach(ch=>{
    const total=ch.facts.length+ch.hints.length;
    const d=document.createElement('div');d.className='chapter';
    d.style.setProperty('--acc',ACCENTS[(typeof ch.n==='number'?ch.n:7)%ACCENTS.length]);
    if(ch.linkOnly){
      d.innerHTML=`<div class="ch-head"><span class="ch-num">🔗</span><h3>${ch.title}</h3></div><div class="meta">평가원 원본 미러(kicegg)와 공식 사이트로 이동</div>`;
      const b=document.createElement('button');b.className='btn secondary';b.textContent='링크 열기';b.onclick=()=>goLinks(ch);d.appendChild(b);
      list.appendChild(d);return;
    }
    const known=ch.facts.filter((_,i)=>S.known[fid(ch,i)]).length;
    const pct=total?Math.round(known*100/total):0;
    const qs=S.quiz[ch.id];
    d.innerHTML=`<div class="ch-head"><span class="ch-num">${ch.n}</span><h3>${ch.title}</h3></div>
      <div class="meta">${ch.min}분 코스 · 카드 ${total}장 · 퀴즈 ${ch.mc.length+ch.selfcheck.length+Math.min(8,ch.facts.length)}문항${qs?` · 최근 퀴즈 ${qs.c}/${qs.t}`:''}</div>
      <div class="progress"><div style="width:${pct}%"></div></div>
      <div class="meta${known===total&&total>0?' done':''}">카드 암기 ${known}/${total}${known===total&&total>0?' ✓':''}</div>`;
    const acts=document.createElement('div');acts.className='ch-actions';
    const b1=document.createElement('button');b1.className='btn';b1.innerHTML='<span class="b-ico">🃏</span> 카드 학습';b1.onclick=()=>goStudy(ch);
    const b2=document.createElement('button');b2.className='btn secondary';b2.innerHTML='<span class="b-ico">✏️</span> 퀴즈';b2.onclick=()=>goQuiz(ch);
    acts.appendChild(b1);acts.appendChild(b2);d.appendChild(acts);list.appendChild(d);
  });
  el.appendChild(list);
  const wb=document.createElement('button');wb.className='btn ghost';wb.textContent=`오답 다시 풀기 (${wrongCount()})`;wb.onclick=()=>goWrong();el.appendChild(wb);
}

/* ---------- 링크 ---------- */
function goLinks(ch){
  setTitle('실제 기출 원문 링크',true);
  const el=main();el.innerHTML='';
  const n=document.createElement('div');n.className='notice';
  n.innerHTML='문제지 저작권은 한국교육과정평가원에 있습니다. 아래는 평가원 원본을 열람할 수 있는 미러(kicegg)와 공식 페이지입니다.';
  el.appendChild(n);
  EXAMS.forEach(([label,url])=>{
    const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';
    a.className='linkcard';a.textContent='🔗 '+label;el.appendChild(a);
  });
}

/* ---------- 카드 학습 (스와이프) ---------- */
function goStudy(ch){
  const cards=[
    ...ch.facts.map((f,i)=>({key:fid(ch,i),tag:'핵심 '+ch.n+'-'+(i+1),front:f[0],back:f[1],note:f[2]||''})),
    ...ch.hints.map((h,i)=>({key:ch.id+':h'+i,tag:'암기 힌트',front:h[0],back:'',note:h[1]}))
  ].sort((a,b)=>(S.known[a.key]?1:0)-(S.known[b.key]?1:0)); // 모르는 것 먼저
  let i=0;const queue=cards.slice();
  setTitle(`챕터 ${ch.n} 카드 학습`,true);
  const el=main();el.innerHTML='';
  const area=document.createElement('div');area.className='deck-area';el.appendChild(area);
  const hint=document.createElement('div');hint.className='swipe-hint';
  hint.innerHTML='<span class="left">◀ 다시 볼래요</span><span>탭: 뒤집기</span><span class="right">알아요 ▶</span>';el.appendChild(hint);
  const btns=document.createElement('div');btns.className='answers';
  const bAgain=document.createElement('button');bAgain.className='btn again';bAgain.textContent='다시 볼래요';
  const bKnow=document.createElement('button');bKnow.className='btn know';bKnow.textContent='알아요';
  btns.appendChild(bAgain);btns.appendChild(bKnow);el.appendChild(btns);
  function done(){
    el.innerHTML=`<div class="summary"><h2>챕터 ${ch.n} 카드 완료 🎉</h2>
      <div class="big-num">${cards.length}</div><p>장의 카드를 봤어요.</p></div>`;
    const b=document.createElement('button');b.className='btn';b.textContent='✏️ 이 챕터 바로 문제 풀기';b.onclick=()=>goQuiz(ch);el.appendChild(b);
    const h=document.createElement('button');h.className='btn ghost';h.textContent='홈으로';h.onclick=()=>goHome();el.appendChild(h);
  }
  function render(){
    area.innerHTML='';
    if(i>=queue.length){done();return}
    const c=queue[i];
    const card=document.createElement('div');card.className='swipe-card';
    card.innerHTML=`<span class="tag">${c.tag} · ${i+1}/${queue.length}</span>
      <div class="front">${c.front}</div>
      <div class="back">${c.back||'암기 힌트'}</div>
      <div class="note">${c.note}</div>
      <div class="hinttap">탭하면 ${c.back?'정답·설명':'내용'} 표시</div>
      <span class="stamp stamp-know">알아요</span><span class="stamp stamp-again">다시</span>`;
    area.appendChild(card);
    const stK=card.querySelector('.stamp-know'),stA=card.querySelector('.stamp-again');
    let sx=0,dx=0,dragging=false,moved=false;
    card.addEventListener('pointerdown',e=>{dragging=true;moved=false;sx=e.clientX;card.setPointerCapture(e.pointerId)});
    card.addEventListener('pointermove',e=>{if(!dragging)return;dx=e.clientX-sx;if(Math.abs(dx)>8)moved=true;
      card.style.transform=`translateX(${dx}px) rotate(${dx/25}deg)`;
      const o=Math.min(1,Math.abs(dx)/90);
      stK.style.opacity=dx>0?o:0;stA.style.opacity=dx<0?o:0});
    card.addEventListener('pointerup',()=>{
      dragging=false;card.style.transform='';stK.style.opacity=0;stA.style.opacity=0;
      if(dx>80)return choose(true);
      if(dx<-80)return choose(false);
      if(!moved)card.classList.toggle('flipped');
      dx=0;
    });
  }
  function choose(known){
    const c=queue[i];
    if(known){S.known[c.key]=1;persist()}
    else{queue.push(c)} // 다시 볼 카드는 뒤로
    i++;render();
  }
  bKnow.onclick=()=>choose(true);
  bAgain.onclick=()=>choose(false);
  render();
  if(location.hash==='#study-demo'){setTimeout(()=>{const c=document.querySelector('.swipe-card');if(c)c.classList.add('flipped')},300)}
}

/* ---------- 퀴즈 ---------- */
function goQuiz(ch,questions,title){
  const qs=questions||buildQuiz(ch);
  let i=0,correct=0;
  setTitle(title||`챕터 ${ch.n} 퀴즈`,true);
  const el=main();
  function finish(){
    if(ch&&ch.n!==undefined&&!questions){S.quiz[ch.id]={c:correct,t:qs.length};persist()}
    el.innerHTML=`<div class="summary"><h2>퀴즈 완료</h2>
      <div class="big-num">${correct}/${qs.length}</div>
      <p>${correct===qs.length?'전부 맞혔어요! 🎉':'틀린 문제는 오답 덱에 들어갔어요. 오답은 2번 연속 맞히면 졸업합니다.'}</p></div>`;
    if(wrongCount()>0){const w=document.createElement('button');w.className='btn again';w.textContent=`오답 바로 다시 풀기 (${wrongCount()})`;w.onclick=()=>goWrong();el.appendChild(w)}
    const h=document.createElement('button');h.className='btn ghost';h.textContent='홈으로';h.onclick=()=>goHome();el.appendChild(h);
  }
  function render(){
    if(i>=qs.length){finish();return}
    const item=qs[i];
    if(typeof window!=='undefined')window.__lastQ=item;
    el.innerHTML='';
    const head=document.createElement('div');head.className='qhead';
    head.innerHTML=`<span>문제 ${i+1}/${qs.length}</span><span class="src-tag">${item.src}</span>`;
    el.appendChild(head);
    const qt=document.createElement('div');qt.className='qtext';qt.textContent=item.q;el.appendChild(qt);
    if(item.type==='mc'){
      let answered=false;
      item.c.forEach((text,ci)=>{
        const b=document.createElement('button');b.className='choice';
        const nm=document.createElement('span');nm.className='num';nm.textContent='①②③④⑤'[ci];
        const tx=document.createElement('span');tx.textContent=text;
        b.appendChild(nm);b.appendChild(tx);
        b.onclick=()=>{
          if(answered)return;answered=true;
          const ok=ci===item.ans;
          el.querySelectorAll('.choice').forEach((x,xi)=>{x.disabled=true;
            if(xi===item.ans)x.classList.add('correct');
            else if(xi===ci)x.classList.add('wrongpick')});
          if(ok){correct++;markRight(item.id)}else{markWrong(item.id)}
          const ex=document.createElement('div');ex.className='explain';
          ex.innerHTML=`<b class="res ${ok?'ok':'no'}">${ok?'정답':'오답'}</b> · ${item.exp}<div class="src">${item.src}</div>`;
          el.appendChild(ex);
          const nx=document.createElement('button');nx.className='btn';nx.id='nextBtn';nx.textContent=i+1<qs.length?'다음 문제':'결과 보기';
          nx.onclick=()=>{i++;render()};el.appendChild(nx);
        };
        el.appendChild(b);
      });
    }else{ /* reveal (셀프 체크) */
      const rev=document.createElement('button');rev.className='btn secondary';rev.textContent='답 보기';
      rev.onclick=()=>{
        rev.remove();
        const ex=document.createElement('div');ex.className='explain';ex.textContent='정답: '+item.a;el.appendChild(ex);
        const row=document.createElement('div');row.className='answers';
        const ok=document.createElement('button');ok.className='btn know';ok.textContent='맞혔어요';
        const no=document.createElement('button');no.className='btn again';no.textContent='틀렸어요';
        ok.onclick=()=>{correct++;markRight(item.id);i++;render()};
        no.onclick=()=>{markWrong(item.id);i++;render()};
        row.appendChild(ok);row.appendChild(no);el.appendChild(row);
      };
      el.appendChild(rev);
    }
  }
  render();
  if(location.hash==='#quiz-demo'){setTimeout(()=>{const q=window.__lastQ;if(q&&q.type==='mc'){document.querySelectorAll('.choice')[(q.ans+1)%q.c.length].click()}},400)}
}

/* ---------- 오답 덱 ---------- */
function goWrong(){
  const ids=Object.keys(S.wrong);
  setTitle('오답 다시 풀기',true);
  const el=main();
  if(ids.length===0){el.innerHTML='<div class="empty">오답이 없어요. 👏<br>퀴즈에서 틀린 문제가 여기 쌓입니다.<br>2번 연속 맞히면 졸업합니다.</div>';return}
  const qs=ids.map(id=>reviveWrong(S.wrong[id])).filter(Boolean);
  qs.forEach(q=>{q.src=(S.wrong[q.id]&&S.wrong[q.id].streak===1?'졸업까지 1번 더 · ':'')+q.src});
  goQuiz({id:'__wrong',n:'오답'},shuffle(qs),'오답 다시 풀기');
}

updateWrongBadge();
(function boot(){
  const h=location.hash;
  const m=h.match(/^#(study|quiz|links)=(\w+)/);
  if(h==='#study-demo'){return goStudy(CHAPTERS.find(c=>c.id==='ch3'))}
  if(m){const ch=CHAPTERS.find(c=>c.id===m[2]);
    if(ch){if(m[1]==='study')return goStudy(ch);if(m[1]==='quiz')return goQuiz(ch);if(m[1]==='links')return goLinks(ch)}}
  if(h==='#wrong')return goWrong();
  if(h==='#wrong-demo'){S.wrong['ch1:f0']={chId:'ch1',kind:'f',idx:0,streak:0};persist();return goWrong()}
  if(h==='#quiz-demo'){const ch=CHAPTERS.find(c=>c.id==='ch7');return goQuiz(ch)}
  goHome();
})();
}
