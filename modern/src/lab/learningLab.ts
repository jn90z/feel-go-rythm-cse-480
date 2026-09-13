import "./learningLab.css";

export {};

type ModuleId = "graphs" | "sorting" | "searching" | "structures" | "trees" | "pathfinding" | "recursion" | "memory" | "hashing" | "scheduling" | "networking" | "concurrency";
type LabModule = { id: ModuleId; icon: string; title: string; description: string; render: (host: HTMLElement) => void };

const launcher = document.createElement("button");
launcher.className = "lab-launcher";
launcher.type = "button";
launcher.textContent = "🧠 Big Brain";
launcher.setAttribute("aria-label", "Open Big Brain learning modules");
document.body.append(launcher);

const overlay = document.createElement("section");
overlay.className = "lab-overlay";
overlay.hidden = true;
overlay.innerHTML = `
  <header class="lab-header">
    <button class="lab-back" type="button" hidden>← Modules</button>
    <div class="lab-title"><h2>Big Brain Learning Lab</h2></div>
    <button class="lab-home" type="button">Back to Graph</button>
  </header>
  <div class="lab-body"></div>`;
document.body.append(overlay);

const body = overlay.querySelector<HTMLElement>(".lab-body")!;
const backButton = overlay.querySelector<HTMLButtonElement>(".lab-back")!;
const graphButton = overlay.querySelector<HTMLButtonElement>(".lab-home")!;
const heading = overlay.querySelector<HTMLHeadingElement>("h2")!;
let cleanup: (() => void) | null = null;

const stopCurrent = () => { cleanup?.(); cleanup = null; };
const closeLab = () => { stopCurrent(); overlay.hidden = true; launcher.hidden = false; };
launcher.addEventListener("click", () => { overlay.hidden = false; launcher.hidden = true; showHome(); });
graphButton.addEventListener("click", closeLab);
backButton.addEventListener("click", showHome);

function controlBar(html: string): string { return `<div class="lab-controls">${html}</div>`; }
function panel(html: string): string { return `<div class="lab-panel">${html}</div>`; }
function clampInt(value: string, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function shuffle(count = 24): number[] {
  const values = Array.from({ length: count }, (_, i) => i + 1);
  for (let i = values.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [values[i], values[j]] = [values[j], values[i]]; }
  return values;
}

interface SortStep { values: number[]; active: number[]; sorted?: number[]; comparisons: number; writes: number; message: string }
function sortSteps(input: number[], algorithm: string): SortStep[] {
  const a = [...input]; const steps: SortStep[] = []; let comparisons = 0; let writes = 0;
  const push = (active: number[], message: string, sorted: number[] = []) => steps.push({ values: [...a], active, sorted, comparisons, writes, message });
  push([], "Ready");
  if (algorithm === "bubble") {
    for (let end = a.length - 1; end > 0; end--) for (let i = 0; i < end; i++) { comparisons++; push([i, i + 1], `Compare ${a[i]} and ${a[i + 1]}`); if (a[i] > a[i + 1]) { [a[i], a[i + 1]] = [a[i + 1], a[i]]; writes += 2; push([i, i + 1], "Swap adjacent values"); } }
  } else if (algorithm === "selection") {
    for (let i = 0; i < a.length - 1; i++) { let min = i; for (let j = i + 1; j < a.length; j++) { comparisons++; if (a[j] < a[min]) min = j; push([min, j], "Scan for the smallest remaining value"); } if (min !== i) { [a[i], a[min]] = [a[min], a[i]]; writes += 2; push([i, min], "Place minimum into position"); } }
  } else if (algorithm === "insertion") {
    for (let i = 1; i < a.length; i++) { const key = a[i]; let j = i - 1; while (j >= 0) { comparisons++; push([j, j + 1], `Compare ${key} with ${a[j]}`); if (a[j] <= key) break; a[j + 1] = a[j]; writes++; j--; } a[j + 1] = key; writes++; push([j + 1], "Insert into sorted prefix"); }
  } else if (algorithm === "merge") {
    const merge = (lo: number, mid: number, hi: number) => { const left = a.slice(lo, mid); const right = a.slice(mid, hi); let i = 0, j = 0, k = lo; while (i < left.length || j < right.length) { if (j >= right.length || (i < left.length && (++comparisons, left[i] <= right[j]))) a[k++] = left[i++]; else a[k++] = right[j++]; writes++; push(Array.from({length: hi-lo},(_,x)=>lo+x), `Merge ranges ${lo}–${mid - 1} and ${mid}–${hi - 1}`); } };
    for (let width = 1; width < a.length; width *= 2) for (let lo = 0; lo < a.length; lo += width * 2) merge(lo, Math.min(lo + width, a.length), Math.min(lo + width * 2, a.length));
  } else if (algorithm === "quick") {
    const quick = (lo: number, hi: number) => { if (lo >= hi) return; const pivot = a[hi]; let i = lo; for (let j = lo; j < hi; j++) { comparisons++; push([j, hi], `Compare with pivot ${pivot}`); if (a[j] <= pivot) { [a[i], a[j]] = [a[j], a[i]]; writes += 2; i++; } } [a[i], a[hi]] = [a[hi], a[i]]; writes += 2; push([i], `Pivot ${pivot} placed`); quick(lo, i - 1); quick(i + 1, hi); }; quick(0, a.length - 1);
  } else if (algorithm === "heap") {
    const heapify = (n: number, i: number) => { while (true) { let largest = i; const l = i * 2 + 1, r = l + 1; if (l < n) { comparisons++; if (a[l] > a[largest]) largest = l; } if (r < n) { comparisons++; if (a[r] > a[largest]) largest = r; } if (largest === i) break; [a[i], a[largest]] = [a[largest], a[i]]; writes += 2; push([i, largest], "Restore max-heap property"); i = largest; } }; for (let i = Math.floor(a.length / 2) - 1; i >= 0; i--) heapify(a.length, i); for (let end = a.length - 1; end > 0; end--) { [a[0], a[end]] = [a[end], a[0]]; writes += 2; push([0, end], "Move heap maximum to sorted suffix"); heapify(end, 0); }
  }
  push([], "Sorted", a.map((_, i) => i)); return steps;
}

function renderSorting(host: HTMLElement): void {
  host.innerHTML = `<div class="lab-module">
    ${controlBar(`<label>Algorithm<select id="sortAlgorithm"><option value="bubble">Bubble</option><option value="selection">Selection</option><option value="insertion">Insertion</option><option value="merge">Merge</option><option value="quick">Quick</option><option value="heap">Heap</option></select></label><label>Items<input id="sortCount" type="number" min="6" max="60" value="24"></label><button id="sortShuffle">Shuffle</button><button id="sortPrev">Previous</button><button id="sortPlay">Play</button><button id="sortNext">Next</button><button id="sortRace">Race Mode</button>`)}
    <div class="lab-meta"><span id="sortStep"></span><span id="sortComparisons"></span><span id="sortWrites"></span><span id="sortMessage"></span></div>
    <div class="lab-visual"><div class="lab-bars" id="sortBars"></div><div id="sortRaceView" hidden></div></div>
    ${panel(`<strong>What to watch</strong><p class="lab-note">Orange bars are being compared or moved. Green bars are finished. Compare the live operation counts to see how algorithm strategy affects work.</p>`)}
  </div>`;
  const alg = host.querySelector<HTMLSelectElement>("#sortAlgorithm")!; const count = host.querySelector<HTMLInputElement>("#sortCount")!; const bars = host.querySelector<HTMLElement>("#sortBars")!; const raceView = host.querySelector<HTMLElement>("#sortRaceView")!; const play = host.querySelector<HTMLButtonElement>("#sortPlay")!;
  let values = shuffle(24), steps = sortSteps(values, alg.value), index = 0, timer: number | null = null;
  const stop = () => { if (timer !== null) window.clearInterval(timer); timer = null; play.textContent = "Play"; };
  cleanup = stop;
  const render = () => { const step = steps[index]; const max = Math.max(...step.values); bars.innerHTML = step.values.map((v, i) => `<div class="lab-bar ${step.active.includes(i) ? "active" : ""} ${step.sorted?.includes(i) ? "sorted" : ""}" style="height:${Math.max(5, v / max * 94)}%"><span>${step.values.length <= 30 ? v : ""}</span></div>`).join(""); host.querySelector<HTMLElement>("#sortStep")!.textContent = `Step ${index + 1} / ${steps.length}`; host.querySelector<HTMLElement>("#sortComparisons")!.textContent = `Comparisons: ${step.comparisons}`; host.querySelector<HTMLElement>("#sortWrites")!.textContent = `Writes/swaps: ${step.writes}`; host.querySelector<HTMLElement>("#sortMessage")!.textContent = step.message; };
  const rebuild = () => { stop(); values = shuffle(clampInt(count.value, 6, 60, 24)); steps = sortSteps(values, alg.value); index = 0; raceView.hidden = true; bars.hidden = false; render(); };
  host.querySelector("#sortShuffle")!.addEventListener("click", rebuild); alg.addEventListener("change", () => { steps = sortSteps(values, alg.value); index = 0; render(); }); host.querySelector("#sortPrev")!.addEventListener("click", () => { stop(); index = Math.max(0, index - 1); render(); }); host.querySelector("#sortNext")!.addEventListener("click", () => { stop(); index = Math.min(steps.length - 1, index + 1); render(); }); play.addEventListener("click", () => { if (timer !== null) return stop(); play.textContent = "Pause"; timer = window.setInterval(() => { if (index >= steps.length - 1) return stop(); index++; render(); }, 140); });
  host.querySelector("#sortRace")!.addEventListener("click", () => { stop(); const contenders = ["bubble", "merge"]; const races = contenders.map(a => sortSteps(values, a)); const pos = [0, 0]; bars.hidden = true; raceView.hidden = false; raceView.innerHTML = `<div class="lab-race">${contenders.map((a, n) => `<div>${panel(`<strong>${a === "bubble" ? "Bubble Sort" : "Merge Sort"}</strong><div class="lab-mini-bars" id="race${n}"></div><p id="raceMeta${n}" class="lab-note"></p>`)}</div>`).join("")}</div>`; const draw = () => contenders.forEach((_, n) => { const s = races[n][pos[n]]; const max = Math.max(...s.values); host.querySelector<HTMLElement>(`#race${n}`)!.innerHTML = s.values.map(v => `<div style="height:${v / max * 100}%"></div>`).join(""); host.querySelector<HTMLElement>(`#raceMeta${n}`)!.textContent = `${pos[n]+1}/${races[n].length} · comparisons ${s.comparisons}`; }); draw(); const raceTimer = window.setInterval(() => { for (let n=0;n<2;n++) if (pos[n] < races[n].length-1) pos[n]++; draw(); if (pos.every((p,n)=>p>=races[n].length-1)) window.clearInterval(raceTimer); }, 55); cleanup = () => window.clearInterval(raceTimer); });
  render();
}

function renderSearching(host: HTMLElement): void {
  host.innerHTML = `<div class="lab-module">${controlBar(`<label>Method<select id="searchMethod"><option value="linear">Linear Search</option><option value="binary">Binary Search</option></select></label><label>Target<input id="searchTarget" type="number" value="37"></label><button id="searchRun">Run Search</button><button id="searchRandom">New Data</button>`)}<div class="lab-meta"><span id="searchInfo"></span></div><div class="lab-visual"><div class="lab-array" id="searchArray"></div></div>${panel(`<strong>Principle</strong><p class="lab-note">Linear search checks values one-by-one. Binary search requires sorted data and repeatedly eliminates half of the remaining search space.</p>`)}</div>`;
  let data = Array.from({length: 14},()=>Math.floor(Math.random()*90)+5).sort((a,b)=>a-b); let timer: number | null = null; cleanup = () => timer !== null && window.clearInterval(timer);
  const draw = (active = -1, found = -1) => host.querySelector<HTMLElement>("#searchArray")!.innerHTML = data.map((v,i)=>`<div class="lab-cell ${i===active?"active":""} ${i===found?"found":""}">${v}</div>`).join(""); draw();
  host.querySelector("#searchRandom")!.addEventListener("click",()=>{data=Array.from({length:14},()=>Math.floor(Math.random()*90)+5).sort((a,b)=>a-b);draw();});
  host.querySelector("#searchRun")!.addEventListener("click",()=>{if(timer!==null)window.clearInterval(timer); const target=Number((host.querySelector<HTMLInputElement>("#searchTarget")!).value); const method=(host.querySelector<HTMLSelectElement>("#searchMethod")!).value; const indices:number[]=[]; if(method==="linear") for(let i=0;i<data.length;i++) indices.push(i); else {let lo=0,hi=data.length-1;while(lo<=hi){const mid=Math.floor((lo+hi)/2);indices.push(mid);if(data[mid]===target)break;if(data[mid]<target)lo=mid+1;else hi=mid-1;}} let p=0; timer=window.setInterval(()=>{const i=indices[p++];draw(i,data[i]===target?i:-1);host.querySelector<HTMLElement>("#searchInfo")!.textContent=`Checked index ${i}, value ${data[i]} · ${p} comparison${p===1?"":"s"}`;if(data[i]===target||p>=indices.length){window.clearInterval(timer!);timer=null;if(data[i]!==target)host.querySelector<HTMLElement>("#searchInfo")!.textContent=`${target} not found after ${p} comparisons.`;}},450);});
}

function renderStructures(host: HTMLElement): void {
  host.innerHTML=`<div class="lab-module">${controlBar(`<label>Structure<select id="dsType"><option value="stack">Stack</option><option value="queue">Queue</option><option value="deque">Deque</option><option value="list">Linked List</option></select></label><label>Value<input id="dsValue" type="number" value="42"></label><button id="dsAdd">Add</button><button id="dsRemove">Remove</button><button id="dsAddFront">Add Front</button><button id="dsReset">Reset</button>`)}<div class="lab-meta"><span id="dsInfo"></span></div><div class="lab-visual"><div class="lab-structure" id="dsVisual"></div></div>${panel(`<strong>Operations</strong><p class="lab-note">Stacks are LIFO, queues are FIFO, deques work from both ends, and linked lists connect nodes through references instead of contiguous array positions.</p>`)}</div>`;
  let values=[8,17,31]; const type=host.querySelector<HTMLSelectElement>("#dsType")!; const draw=()=>{const v=host.querySelector<HTMLElement>("#dsVisual")!; if(type.value==="list") v.innerHTML=`<span>HEAD →</span>${values.map((x,i)=>`<div class="lab-block">${x} | ${i===values.length-1?"NULL":"•"}</div>${i<values.length-1?'<span class="lab-arrow">→</span>':''}`).join("")}`; else v.innerHTML=values.map(x=>`<div class="lab-block">${x}</div>`).join(type.value==="stack"?"":"<span class=\"lab-arrow\">→</span>"); host.querySelector<HTMLElement>("#dsInfo")!.textContent=`${values.length} item${values.length===1?"":"s"}`;}; type.addEventListener("change",draw); host.querySelector("#dsAdd")!.addEventListener("click",()=>{values.push(Number(host.querySelector<HTMLInputElement>("#dsValue")!.value)||0);draw();}); host.querySelector("#dsAddFront")!.addEventListener("click",()=>{if(type.value==="stack")return;values.unshift(Number(host.querySelector<HTMLInputElement>("#dsValue")!.value)||0);draw();});host.querySelector("#dsRemove")!.addEventListener("click",()=>{if(!values.length)return;if(type.value==="stack")values.pop();else values.shift();draw();});host.querySelector("#dsReset")!.addEventListener("click",()=>{values=[8,17,31];draw();});draw();
}

interface BNode { value:number; left:BNode|null; right:BNode|null }
function renderTrees(host: HTMLElement): void {
  host.innerHTML=`<div class="lab-module">${controlBar(`<label>Insert value<input id="treeValue" type="number" value="55"></label><button id="treeInsert">Insert</button><button data-tr="in">In-order</button><button data-tr="pre">Pre-order</button><button data-tr="post">Post-order</button><button id="treeReset">Reset</button>`)}<div class="lab-meta"><span id="treeInfo"></span></div><div class="lab-visual"><div class="lab-tree" id="treeVisual"></div></div>${panel(`<strong>BST rule</strong><p class="lab-note">Values smaller than a node go left; larger values go right. In-order traversal visits a BST in sorted order.</p>`)}</div>`;
  let root:BNode|null=null; const insert=(v:number)=>{const n:BNode={value:v,left:null,right:null};if(!root){root=n;return;}let cur=root;while(true){if(v<cur.value){if(cur.left)cur=cur.left;else{cur.left=n;return;}}else if(v>cur.value){if(cur.right)cur=cur.right;else{cur.right=n;return;}}else return;}}; [50,30,70,20,40,60,80].forEach(insert);
  const layout=()=>{const nodes:{n:BNode,x:number,y:number}[]=[];const walk=(n:BNode|null,depth:number,x:number,span:number)=>{if(!n)return;nodes.push({n,x,y:depth*80+40});walk(n.left,depth+1,x-span,span/2);walk(n.right,depth+1,x+span,span/2);};walk(root,0,400,180);const edges:string[]=[];for(const p of nodes){for(const c of [p.n.left,p.n.right]){if(c){const q=nodes.find(x=>x.n===c)!;edges.push(`<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="#627086" stroke-width="3"/>`);}}}host.querySelector<HTMLElement>("#treeVisual")!.innerHTML=`<svg viewBox="0 0 800 360" role="img" aria-label="Binary search tree">${edges.join("")}${nodes.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="24" fill="#253247" stroke="#7b8ba3"/><text x="${p.x}" y="${p.y+5}" text-anchor="middle" fill="white" font-size="15">${p.n.value}</text>`).join("")}</svg>`;}; const traverse=(kind:string)=>{const out:number[]=[];const go=(n:BNode|null)=>{if(!n)return;if(kind==="pre")out.push(n.value);go(n.left);if(kind==="in")out.push(n.value);go(n.right);if(kind==="post")out.push(n.value);};go(root);host.querySelector<HTMLElement>("#treeInfo")!.textContent=`${kind}-order: ${out.join(" → ")}`;}; host.querySelector("#treeInsert")!.addEventListener("click",()=>{insert(Number(host.querySelector<HTMLInputElement>("#treeValue")!.value));layout();}); host.querySelectorAll<HTMLButtonElement>("[data-tr]").forEach(b=>b.addEventListener("click",()=>traverse(b.dataset.tr!))); host.querySelector("#treeReset")!.addEventListener("click",()=>{root=null;[50,30,70,20,40,60,80].forEach(insert);layout();});layout();
}

function renderPathfinding(host: HTMLElement): void {
  const rows=12, cols=16, total=rows*cols, start=0, goal=total-1; let walls=new Set<number>(); let timer:number|null=null; cleanup=()=>timer!==null&&window.clearInterval(timer);
  host.innerHTML=`<div class="lab-module">${controlBar(`<label>Algorithm<select id="pathAlg"><option value="bfs">BFS</option><option value="dfs">DFS</option><option value="dijkstra">Dijkstra</option><option value="astar">A*</option></select></label><button id="pathRun">Run</button><button id="pathMaze">Random Walls</button><button id="pathClear">Clear</button>`)}<div class="lab-meta"><span id="pathInfo">Tap cells to toggle walls.</span></div><div class="lab-visual"><div class="lab-grid" id="pathGrid"></div></div>${panel(`<strong>Why compare?</strong><p class="lab-note">BFS explores by distance, DFS dives down one route, Dijkstra handles path cost, and A* adds a heuristic that aims the search toward the goal.</p>`)}</div>`;
  const grid=host.querySelector<HTMLElement>("#pathGrid")!; const draw=(visited=new Set<number>(),path=new Set<number>())=>{grid.innerHTML=Array.from({length:total},(_,i)=>`<button type="button" data-cell="${i}" aria-label="grid cell ${i}" class="${i===start?"start":i===goal?"goal":walls.has(i)?"wall":path.has(i)?"path":visited.has(i)?"visited":""}"></button>`).join("");grid.querySelectorAll<HTMLButtonElement>("[data-cell]").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.cell);if(i===start||i===goal)return;walls.has(i)?walls.delete(i):walls.add(i);draw();}));};draw();
  const solve=(kind:string)=>{const frontier=[start], came=new Map<number,number>(), seen=new Set<number>([start]), order:number[]=[]; const h=(i:number)=>Math.abs(Math.floor(i/cols)-Math.floor(goal/cols))+Math.abs(i%cols-goal%cols); while(frontier.length){if(kind==="astar"||kind==="dijkstra")frontier.sort((a,b)=>(kind==="astar"?h(a):0)-(kind==="astar"?h(b):0));const cur=kind==="dfs"?frontier.pop()!:frontier.shift()!;order.push(cur);if(cur===goal)break;const r=Math.floor(cur/cols),c=cur%cols;for(const [rr,cc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]){const n=rr*cols+cc;if(rr<0||rr>=rows||cc<0||cc>=cols||walls.has(n)||seen.has(n))continue;seen.add(n);came.set(n,cur);frontier.push(n);}}const path:number[]=[];if(seen.has(goal)){let cur=goal;while(cur!==start){path.push(cur);cur=came.get(cur)!;}path.push(start);path.reverse();}return{order,path};};
  host.querySelector("#pathRun")!.addEventListener("click",()=>{if(timer!==null)window.clearInterval(timer);const result=solve(host.querySelector<HTMLSelectElement>("#pathAlg")!.value), visited=new Set<number>();let i=0;timer=window.setInterval(()=>{if(i<result.order.length){visited.add(result.order[i++]);draw(visited);}else{window.clearInterval(timer!);timer=null;draw(visited,new Set(result.path));host.querySelector<HTMLElement>("#pathInfo")!.textContent=result.path.length?`Visited ${visited.size} cells · path length ${result.path.length-1}`:`No path found after visiting ${visited.size} cells.`;}},28);});host.querySelector("#pathMaze")!.addEventListener("click",()=>{walls=new Set(Array.from({length:total},(_,i)=>i).filter(i=>i!==start&&i!==goal&&Math.random()<.22));draw();});host.querySelector("#pathClear")!.addEventListener("click",()=>{walls.clear();draw();});
}

function renderRecursion(host: HTMLElement): void {
  host.innerHTML=`<div class="lab-module">${controlBar(`<label>Example<select id="recType"><option value="fib">Fibonacci</option><option value="fact">Factorial</option></select></label><label>n<input id="recN" type="number" min="1" max="8" value="5"></label><button id="recRun">Build Calls</button>`)}<div class="lab-meta"><span id="recInfo"></span></div><div class="lab-visual"><div class="lab-recursion" id="recVisual"></div></div>${panel(`<strong>Key idea</strong><p class="lab-note">Each recursive call creates another stack frame. The visualization lists calls in execution order so you can see the stack grow and unwind.</p>`)}</div>`;
  host.querySelector("#recRun")!.addEventListener("click",()=>{const n=clampInt(host.querySelector<HTMLInputElement>("#recN")!.value,1,8,5), type=host.querySelector<HTMLSelectElement>("#recType")!.value, calls:string[]=[];let result=0;if(type==="fib"){const f=(x:number):number=>{calls.push(`fib(${x})`);return x<2?x:f(x-1)+f(x-2);};result=f(n);}else{const f=(x:number):number=>{calls.push(`fact(${x})`);return x<=1?1:x*f(x-1);};result=f(n);}host.querySelector<HTMLElement>("#recVisual")!.innerHTML=calls.map((c,i)=>`<div class="lab-call">${i+1}. ${c}</div>`).join("");host.querySelector<HTMLElement>("#recInfo")!.textContent=`Result: ${result} · ${calls.length} calls`;});host.querySelector<HTMLButtonElement>("#recRun")!.click();
}

function renderMemory(host: HTMLElement): void {
  host.innerHTML=`<div class="lab-module">${controlBar(`<label>x value<input id="memX" type="number" value="42"></label><button id="memAssign">Assign x</button><button id="memPointer">p = &x</button><button id="memDeref">*p = 17</button><button id="memAlloc">Allocate heap Node</button><button id="memFree">Free heap Node</button>`)}<div class="lab-meta"><span id="memInfo"></span></div><div class="lab-visual"><div class="lab-memory"><div class="lab-mem-col"><strong>Stack</strong><div id="memStack"></div></div><div class="lab-mem-col"><strong>Heap</strong><div id="memHeap"></div></div></div></div>${panel(`<pre class="lab-code" id="memCode">int x = 42;\nint* p = nullptr;</pre>`)} </div>`;
  let x=42,p=false,heap=false;const draw=(msg="")=>{host.querySelector<HTMLElement>("#memStack")!.innerHTML=`<div class="lab-mem-cell">0x1048 · x = ${x}</div><div class="lab-mem-cell">0x1050 · p = ${p?"0x1048":"nullptr"}</div>`;host.querySelector<HTMLElement>("#memHeap")!.innerHTML=heap?`<div class="lab-mem-cell">0x2000 · Node { value: ${x} }</div>`:`<div class="lab-mem-cell">(no allocation)</div>`;host.querySelector<HTMLElement>("#memInfo")!.textContent=msg;};host.querySelector("#memAssign")!.addEventListener("click",()=>{x=Number(host.querySelector<HTMLInputElement>("#memX")!.value)||0;draw("Changed the stack variable x.");});host.querySelector("#memPointer")!.addEventListener("click",()=>{p=true;draw("p now stores x's address: 0x1048.");});host.querySelector("#memDeref")!.addEventListener("click",()=>{if(!p)return draw("Set p = &x first.");x=17;draw("Dereferencing p changed x to 17.");});host.querySelector("#memAlloc")!.addEventListener("click",()=>{heap=true;draw("Allocated a Node on the heap.");});host.querySelector("#memFree")!.addEventListener("click",()=>{heap=false;draw("Heap allocation released.");});draw();
}

function renderHashing(host: HTMLElement): void {
  host.innerHTML=`<div class="lab-module">${controlBar(`<label>Key<input id="hashKey" type="number" value="42"></label><button id="hashInsert">Insert</button><button id="hashFind">Find</button><button id="hashReset">Reset</button>`)}<div class="lab-meta"><span id="hashInfo"></span></div><div class="lab-visual"><div class="lab-buckets" id="hashBuckets"></div></div>${panel(`<strong>Hash function</strong><p class="lab-note">This demo uses key mod 8. Collisions are handled with separate chaining, so multiple keys can live in the same bucket.</p>`)}</div>`;
  let buckets:number[][]=Array.from({length:8},()=>[]);const draw=(active=-1)=>{host.querySelector<HTMLElement>("#hashBuckets")!.innerHTML=buckets.map((b,i)=>`<div class="lab-bucket" style="${i===active?'outline:3px solid #f0a84a':''}"><strong>${i}</strong>${b.length?b.join(" → "):"empty"}</div>`).join("");};host.querySelector("#hashInsert")!.addEventListener("click",()=>{const k=Number(host.querySelector<HTMLInputElement>("#hashKey")!.value)||0,i=((k%8)+8)%8;if(!buckets[i].includes(k))buckets[i].push(k);draw(i);host.querySelector<HTMLElement>("#hashInfo")!.textContent=`hash(${k}) = ${i}`;});host.querySelector("#hashFind")!.addEventListener("click",()=>{const k=Number(host.querySelector<HTMLInputElement>("#hashKey")!.value)||0,i=((k%8)+8)%8;draw(i);host.querySelector<HTMLElement>("#hashInfo")!.textContent=buckets[i].includes(k)?`${k} found in bucket ${i}.`:`${k} is not in bucket ${i}.`;});host.querySelector("#hashReset")!.addEventListener("click",()=>{buckets=Array.from({length:8},()=>[]);draw();});[10,18,26,7,42].forEach(k=>buckets[((k%8)+8)%8].push(k));draw();
}

function renderScheduling(host: HTMLElement): void {
  host.innerHTML=`<div class="lab-module">${controlBar(`<label>Policy<select id="schedPolicy"><option value="fcfs">First Come First Served</option><option value="rr">Round Robin (q=2)</option><option value="sjf">Shortest Job First</option></select></label><button id="schedRun">Build Schedule</button><button id="schedRandom">Random Jobs</button>`)}<div class="lab-meta"><span id="schedInfo"></span></div><div class="lab-visual"><div class="lab-timeline" id="schedTimeline"></div></div>${panel(`<strong>CPU scheduling</strong><p class="lab-note">Scheduling policy changes responsiveness and waiting time even when the same jobs must eventually consume the same total CPU time.</p>`)}</div>`;
  let jobs=[{id:"A",burst:5},{id:"B",burst:2},{id:"C",burst:7},{id:"D",burst:3}];const run=()=>{const policy=host.querySelector<HTMLSelectElement>("#schedPolicy")!.value;let slots:string[]=[];if(policy==="fcfs")jobs.forEach(j=>slots.push(...Array(j.burst).fill(j.id)));else if(policy==="sjf")[...jobs].sort((a,b)=>a.burst-b.burst).forEach(j=>slots.push(...Array(j.burst).fill(j.id)));else{const q=jobs.map(j=>({...j,rem:j.burst}));while(q.some(j=>j.rem>0))for(const j of q)for(let n=0;n<2&&j.rem>0;n++,j.rem--)slots.push(j.id);}host.querySelector<HTMLElement>("#schedTimeline")!.innerHTML=slots.map((s,i)=>`<div class="lab-slot">${s}<small>${i}</small></div>`).join("");host.querySelector<HTMLElement>("#schedInfo")!.textContent=`Jobs: ${jobs.map(j=>`${j.id}:${j.burst}`).join(" · ")} · total CPU ${slots.length}`;};host.querySelector("#schedRun")!.addEventListener("click",run);host.querySelector("#schedRandom")!.addEventListener("click",()=>{jobs="ABCD".split("").map(id=>({id,burst:1+Math.floor(Math.random()*7)}));run();});run();
}

function renderNetworking(host: HTMLElement): void {
  const names=["Client","Router A","Router B","Router C","Server"];host.innerHTML=`<div class="lab-module">${controlBar(`<button id="netSend">Send Packet</button><button id="netLoss">Simulate Loss + Retry</button>`)}<div class="lab-meta"><span id="netInfo"></span></div><div class="lab-visual"><div class="lab-network" id="netVisual">${names.map((n,i)=>`<div class="lab-router" data-hop="${i}">${n}</div>`).join("")}</div></div>${panel(`<strong>Packet switching</strong><p class="lab-note">A packet advances hop-by-hop instead of travelling magically from one computer to another. Loss demonstrates why reliable protocols need acknowledgements and retries.</p>`)}</div>`;let timer:number|null=null;cleanup=()=>timer!==null&&window.clearInterval(timer);const send=(loss=false)=>{if(timer!==null)window.clearInterval(timer);let i=0,retrying=false;const hops=[...host.querySelectorAll<HTMLElement>("[data-hop]")];timer=window.setInterval(()=>{hops.forEach(h=>h.classList.remove("active"));hops[i].classList.add("active");host.querySelector<HTMLElement>("#netInfo")!.textContent=`Packet at ${names[i]}`;if(loss&&i===2&&!retrying){retrying=true;host.querySelector<HTMLElement>("#netInfo")!.textContent="Packet lost at Router B — timeout, then retry.";i=0;return;}if(i++>=hops.length-1){window.clearInterval(timer!);timer=null;host.querySelector<HTMLElement>("#netInfo")!.textContent="Packet delivered to server.";}},650);};host.querySelector("#netSend")!.addEventListener("click",()=>send(false));host.querySelector("#netLoss")!.addEventListener("click",()=>send(true));
}

function renderConcurrency(host: HTMLElement): void {
  host.innerHTML=`<div class="lab-module">${controlBar(`<button id="raceUnsafe">Run Race Condition</button><button id="raceMutex">Run With Mutex</button><button id="raceReset">Reset</button>`)}<div class="lab-meta"><span id="raceInfo"></span></div><div class="lab-visual"><div class="lab-structure"><div class="lab-block">Thread A<br><strong id="threadA">idle</strong></div><div class="lab-block">Shared counter<br><strong id="counter">0</strong></div><div class="lab-block">Thread B<br><strong id="threadB">idle</strong></div></div></div>${panel(`<strong>Critical sections</strong><p class="lab-note">Without synchronization, two threads can read the same old value and overwrite each other's work. A mutex serializes access to the shared state.</p>`)}</div>`;let counter=0,timers:number[]=[];cleanup=()=>timers.forEach(clearTimeout);const set=(a:string,b:string,msg:string)=>{host.querySelector<HTMLElement>("#threadA")!.textContent=a;host.querySelector<HTMLElement>("#threadB")!.textContent=b;host.querySelector<HTMLElement>("#counter")!.textContent=String(counter);host.querySelector<HTMLElement>("#raceInfo")!.textContent=msg;};host.querySelector("#raceUnsafe")!.addEventListener("click",()=>{const snapshot=counter;set(`read ${snapshot}`,`read ${snapshot}`,"Both threads read before either write occurs.");timers.push(window.setTimeout(()=>{counter=snapshot+1;set("write","waiting","Thread A writes +1.");},500),window.setTimeout(()=>{counter=snapshot+1;set("done","write","Thread B writes the same +1: one increment was lost.");},900));});host.querySelector("#raceMutex")!.addEventListener("click",()=>{const first=counter;set(`locked/read ${first}`,"blocked","Thread A owns the mutex.");timers.push(window.setTimeout(()=>{counter=first+1;set("unlock",`locked/read ${counter}`,"Thread B enters after A releases the mutex.");},500),window.setTimeout(()=>{counter+=1;set("done","done","Both increments are preserved.");},1000));});host.querySelector("#raceReset")!.addEventListener("click",()=>{counter=0;set("idle","idle","Reset.");});set("idle","idle","Ready.");
}

const modules: LabModule[] = [
  {id:"graphs",icon:"◯—◯",title:"Graphs",description:"BFS, DFS, Dijkstra, A*, Bellman-Ford, Prim and Kruskal in the existing 3D graph workspace.",render:()=>closeLab()},
  {id:"sorting",icon:"▂▆▃█",title:"Sorting",description:"Animate comparisons, swaps and writes. Includes Bubble, Selection, Insertion, Merge, Quick, Heap and Race Mode.",render:renderSorting},
  {id:"searching",icon:"⌕",title:"Searching",description:"Compare linear and binary search over an ordered array.",render:renderSearching},
  {id:"structures",icon:"[ ]→[ ]",title:"Data Structures",description:"Manipulate stacks, queues, deques and linked lists.",render:renderStructures},
  {id:"trees",icon:"⌘",title:"Trees",description:"Build a binary search tree and explore common traversals.",render:renderTrees},
  {id:"pathfinding",icon:"▦",title:"Pathfinding",description:"Draw walls and compare BFS, DFS, Dijkstra and A* on a tile grid.",render:renderPathfinding},
  {id:"recursion",icon:"↳",title:"Recursion",description:"See call expansion for Fibonacci and factorial.",render:renderRecursion},
  {id:"memory",icon:"0x",title:"Memory & Pointers",description:"Visualize stack variables, pointers, dereferencing and heap allocation.",render:renderMemory},
  {id:"hashing",icon:"#",title:"Hashing",description:"Hash keys into buckets and watch collision chaining.",render:renderHashing},
  {id:"scheduling",icon:"▰▰▰",title:"CPU Scheduling",description:"Compare FCFS, shortest-job-first and round-robin timelines.",render:renderScheduling},
  {id:"networking",icon:"⇄",title:"Networking",description:"Follow packets across routers and simulate loss/retry.",render:renderNetworking},
  {id:"concurrency",icon:"⇉",title:"Concurrency",description:"Trigger a race condition, then fix it with a mutex.",render:renderConcurrency}
];

function showHome(): void {
  stopCurrent(); backButton.hidden = true; heading.textContent = "Big Brain Learning Lab";
  body.innerHTML = `<div class="lab-home-grid">${modules.map(m=>`<button type="button" class="lab-card" data-module="${m.id}"><span class="lab-icon">${m.icon}</span><h3>${m.title}</h3><p>${m.description}</p></button>`).join("")}</div>`;
  body.querySelectorAll<HTMLButtonElement>("[data-module]").forEach(card => card.addEventListener("click", () => openModule(card.dataset.module as ModuleId)));
}

function openModule(id: ModuleId): void {
  const module = modules.find(m=>m.id===id); if(!module)return;
  stopCurrent(); if(id==="graphs")return closeLab(); backButton.hidden=false; heading.textContent=module.title; body.replaceChildren(); const host=document.createElement("div"); body.append(host); module.render(host);
}
