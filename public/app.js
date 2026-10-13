const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const drawings = {
  ticket:'<path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6ZM15 6v3M15 11v2M15 15v3"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h.01M12 14h.01M17 14h.01M7 18h.01M12 18h.01"/>',
  register:'<rect x="3" y="10" width="18" height="11" rx="2"/><path d="M6 10V4h12v6M7 15h.01M11 15h.01M7 18h.01M11 18h.01M16 14h2v4h-2M8 7h8"/>',
  chart:'<path d="M4 3v18h17M8 16v-4M13 16V8M18 16V5"/>',
  box:'<path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7 5l10 4"/>',
  user:'<circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>',
  logout:'<path d="M9 4H4v16h5M14 8l4 4-4 4M9 12h12"/>',
  arrow:'<path d="M4 12h15M14 7l5 5-5 5"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  cocktail:'<path d="m3 4 9 10 9-10H3ZM12 14v7M7 21h10M7 8h10M15 7l4-5"/>',
  glass:'<path d="M6 3h12l-1 18H7L6 3ZM7 10h10M11 10l5-8"/>',
  whiskey:'<path d="m4 6 2 15h12l2-15H4ZM6 14h12M8 14l1-4 5 1-1 3M13 14l1-3 3 1-1 2"/>',
  wine:'<path d="M7 3h10l1 6a6 6 0 0 1-12 0l1-6ZM12 15v6M8 21h8M6 9h12"/>',
  water:'<path d="M9 3h6v3l3 4v10H6V10l3-4V3ZM9 6h6M6 13h12M6 17h12"/>',
  snack:'<path d="M3 12h18a9 9 0 0 1-18 0ZM7 12c-3-4 2-5 3-2M12 12c-2-5 3-6 4-2M16 12c0-3 4-4 4 0M7 21h10"/>',
  food:'<path d="M5 3v6a3 3 0 0 0 6 0V3M8 3v18M16 3v10h4M20 3v18"/>',
  coffee:'<path d="M4 9h12v6a5 5 0 0 1-10 0V9M16 10h2a3 3 0 0 1 0 6h-2M3 21h16M7 3v3M11 2v4"/>',
  cigar:'<path d="M3 13h16v6H3zM6 13v6M16 13v6M19 13h2v6h-2M8 9c-3-3 3-3 0-6M14 9c-3-3 3-3 0-6"/>',
  shisha:'<path d="M9 3h6l-1 3h-4L9 3ZM12 6v7M8 13h8l2 5-3 3H9l-3-3 2-5ZM8 10h8M16 12c7-2 7 8 3 8M19 20h-1"/>',
  aroma:'<path d="M4 20C2 8 10 3 21 3c0 11-5 18-17 17ZM4 20 17 7M8 16v-5M8 16h5"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
  check:'<path d="m5 12 4 4L20 5"/>',
  coin:'<circle cx="12" cy="12" r="9"/><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9M12 6v12"/>',
  card:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 7h6M9 11h6M9 15h3"/>',
  edit:'<path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
};
const icon = (name,cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${drawings[name]||drawings.glass}</svg>`;
const categoryIcon = category => ({Essen:'food','Alkoholische Getränke':'whiskey','Alkoholfreie Getränke':'water','Kaffeespezialitäten':'coffee','Zigaretten & Zigarren':'cigar',Spezielles:'wine',Shisha:'shisha',Aromen:'aroma',Cocktails:'cocktail',Longdrinks:'glass',Spirituosen:'whiskey','Bier & Wein':'wine',Alkoholfrei:'water',Snacks:'snack'}[category] || 'glass');
const initials = name => name.trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
const state = { config:null,employee:null,view:'kasse',products:[],cart:[],purchaseCart:[],payment:'cash',discountPercent:0,discountValid:true,requestId:null,pending:null,operationPending:null,category:'Alle',search:'',period:'today',from:null,to:null,statsCurrency:null,connected:true,busy:false,epoch:0,lastOrder:null };
const modal = $('#modal');
let toastTimer;
function toast(message,error=false) {
  const element=$('#toast'); element.textContent=message; element.className=`show${error?' error-toast':''}`;
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>element.className='',error?6500:4000);
}
function money(cents,currency=state.config?.currency||'USD') {
  return new Intl.NumberFormat('de-DE',{style:'currency',currency,minimumFractionDigits:2}).format(Number(cents)/100);
}
const time = value => new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
const date = value => new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value));
function today() {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get=type=>parts.find(p=>p.type===type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function setPeriod(period) {
  state.period=period; const d=today(); state.to=d;
  if (period==='today') state.from=d;
  if (period==='week') { const day=new Date(`${d}T12:00:00Z`);day.setUTCDate(day.getUTCDate()-6);state.from=day.toISOString().slice(0,10); }
  if (period==='month') state.from=d.slice(0,7)+'-01';
  if (period==='all') state.from=state.to=null;
}
function queryRange() {
  const params=new URLSearchParams(); if(state.from)params.set('from',state.from);if(state.to)params.set('to',state.to);params.set('currency',state.statsCurrency||state.config?.currency||'USD');return params.toString();
}
function connection(ok) {
  state.connected=ok;
  const el=$('#connection');
  if(el){el.className=`connection${ok?'':' offline'}`;el.innerHTML=`<span class="status-dot"></span>${ok?'Zentral verbunden':'Verbindung unterbrochen'}`;}
}
async function api(url,{method='GET',body}={}) {
  let response;
  try { response=await fetch(`/api${url}`,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)}); }
  catch { connection(false); const error=new Error('Keine Verbindung. Bitte prüfe dein Internet und versuche es erneut.');error.status=0;throw error; }
  const data=await response.json().catch(()=>({error:'Der Server ist gerade nicht erreichbar.'}));
  if(!response.ok){
    if(data.code==='ROLE_FORBIDDEN'&&data.employee)updateEmployeeHeader(data.employee);
    const error=new Error(data.error||'Die Anfrage ist fehlgeschlagen.');error.status=response.status;
    if(response.status===401 && url!=='/login' && state.employee){
      saveDraft();state.employee=null;if(modal.open)modal.close();renderLogin();
    }
    throw error;
  }
  connection(true);return data;
}
function saveDraft() {
  if(!state.employee)return;
  try {localStorage.setItem(`gentlemans-cart-${state.employee.id}`,JSON.stringify({cart:state.cart,payment:state.payment,discountPercent:state.discountPercent,requestId:state.requestId,pending:state.pending,operationPending:state.operationPending,purchaseCart:state.purchaseCart}));} catch {/* Die zentrale Buchung bleibt unabhängig vom lokalen Warenkorb. */}
}
function restoreDraft() {
  state.admissionDraft=null;
  state.cart=[];state.purchaseCart=[];state.payment='cash';state.discountPercent=0;state.discountValid=true;state.requestId=crypto.randomUUID();state.pending=null;state.operationPending=null;state.lastOrder=null;
  try {
    const saved=JSON.parse(localStorage.getItem(`gentlemans-cart-${state.employee.id}`)||'null');
    if(saved && Array.isArray(saved.cart)){
      state.cart=saved.cart.filter(p=>p && typeof p.id==='string' && typeof p.name==='string' && Number.isInteger(p.price_cents) && Number.isInteger(p.quantity) && p.quantity>0 && p.quantity<=999);
      state.payment=['cash','card'].includes(saved.payment)?saved.payment:'cash';state.requestId=saved.requestId||crypto.randomUUID();state.pending=saved.pending||null;state.operationPending=saved.operationPending||null;const savedDiscount=state.pending?(state.pending.discount_percent??0):(saved.discountPercent??0);state.discountPercent=validDiscountPercent(savedDiscount)?savedDiscount:0;state.purchaseCart=Array.isArray(saved.purchaseCart)?saved.purchaseCart.filter(i=>i&&typeof i.id==='string'&&typeof i.name==='string'&&Number.isInteger(i.unitCostCents)&&i.unitCostCents>0&&Number.isInteger(i.quantity)&&i.quantity>0&&i.quantity<=100000):[];
    }
  }catch{}
}
function brand(){return `<div class="brand"><img src="/assets/emblem.png" alt="Logo der Gentlemans Bar"><div><div class="brand-name">GENTLEMANS</div><div class="brand-subtitle">BAR · GRAPESEED</div></div></div>`;}
function renderLogin() {
  let rememberedName='';try{rememberedName=localStorage.getItem('gentlemans-last-name')||'';}catch{}
  $('#app').innerHTML=`<main class="login-page"><section class="login-scene">${brand()}<div class="login-intro"><img class="login-emblem" src="/assets/emblem.png" alt=""><h1>Gute Drinks.<br><em>Klare Zahlen.</em></h1><p>Ein Ort für gute Gesellschaft.<br>Eine Kasse, die den Überblick behält.</p></div><div class="scene-footer"><span>GRAPESEED · PLZ 2007</span><span>GENTLEMANS BAR</span></div></section><section class="login-panel"><form class="login-form" id="login-form"><div class="eyebrow"><span class="status-dot"></span>Hinter der Bar</div><h2>Willkommen im Team.</h2><p>Melde dich mit deinem Namen<br>und dem gemeinsamen Bar-Passwort an.</p><div class="field"><label for="employee-name">Dein Name</label><input id="employee-name" name="name" value="${esc(rememberedName)}" placeholder="Vor- und Nachname" required minlength="2" maxlength="40" autocomplete="username" ${rememberedName?'':'autofocus'}></div><div class="field"><label for="bar-password">Passwort</label><input id="bar-password" name="password" type="password" maxlength="256" placeholder="Bar-Passwort" autocomplete="current-password" required ${rememberedName?'autofocus':''}></div><label class="filter-check remember-login"><input name="remember_me" type="checkbox" checked>Angemeldet bleiben · 30 Tage</label><button class="button gold full" type="submit"><span>Kasse öffnen</span>${icon('arrow')}</button><p id="login-error" class="error" role="alert"></p><div class="login-note">${icon('user')}<span>Nutze immer denselben Namen.<br>So bleiben deine Buchungen dir zugeordnet.</span></div></form></section></main>`;
  $('#login-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,button=$('button[type=submit]',form);button.disabled=true;$('#login-error').textContent='';
    try{
      const result=await api('/login',{method:'POST',body:{name:form.elements.name.value,password:form.elements.password.value,remember_me:form.elements.remember_me.checked}});
      try{if(form.elements.remember_me.checked)localStorage.setItem('gentlemans-last-name',result.employee.name);else localStorage.removeItem('gentlemans-last-name');}catch{}
      state.employee=result.employee;state.view='kasse';state.category='Alle';state.search='';restoreDraft();await startApp();
    }catch(error){if($('#login-error'))$('#login-error').textContent=error.message;button.disabled=false;}
  });
}

function shell() {
  $('#app').innerHTML=`<header class="app-header">${brand()}<nav class="nav" aria-label="Hauptnavigation">${navigationMarkup()}</nav><div class="user-area"><div class="avatar">${esc(initials(state.employee.name))}</div><div><div class="user-name">${esc(state.employee.name)}</div><div class="user-role">${esc(employeeRole(state.employee))}</div></div><button class="icon-button" data-action="logout" aria-label="Abmelden" title="Abmelden">${icon('logout')}</button></div></header><div id="operation-recovery"></div><main id="main" class="main"></main><footer class="app-footer"><span class="footer-mark">${icon('cocktail')}GENTLEMANS BAR · GRAPESEED</span><span>GUTE GESELLSCHAFT. KLARE ABRECHNUNG.</span></footer>`;
}
function pageHeading(title,subtitle,eyebrow='Hinter der Bar') {
  const formatted=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'long',day:'numeric',month:'long'}).format(new Date());
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="date-status">${esc(formatted)}<div id="connection" class="connection${state.connected?'':' offline'}"><span class="status-dot"></span>${state.connected?'Zentral verbunden':'Verbindung unterbrochen'}</div></div></div>`;
}
async function startApp() {
  try{state.view=allowedView(state.view)?state.view:homeView();state.products=can('cashier')?(await api('/products')).products:[];shell();recoveryNotice();await renderPage();}
  catch(error){if(state.employee){shell();$('#main').innerHTML=`<div class="empty-state">${icon('info')}<h3>Die Kasse wartet kurz.</h3><p>${esc(error.message)}</p><br><button class="button gold" data-action="reload">Erneut verbinden</button></div>`;}}
}
async function renderPage() {
  if(!state.employee)return;
  if(!allowedView(state.view))state.view=homeView();
  const epoch=++state.epoch;
  document.querySelectorAll('.nav button').forEach(b=>{b.classList.toggle('active',b.dataset.view===state.view);if(b.dataset.view===state.view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  if(state.view==='kasse'){renderKasse();refreshMetrics().catch(()=>{});}
  if(state.view==='stats')await renderStats(epoch);
  if(state.view==='admin')await renderAdmin(epoch);
  if(state.view==='inventory')await renderInventory(epoch);
  if(state.view==='vip')await renderVIP(epoch);
  if(state.view==='finance')await renderFinance(epoch);
  if(state.view==='purchases')await renderPurchases(epoch);
  if(state.view==='wallet')await renderWallet(epoch);
  if(state.view==='employees')await renderEmployees(epoch);
  if(state.view==='events')await renderEvents(epoch);
  if(state.view==='entrance')await renderAdmissions(epoch);
}
function renderKasse() {
  $('#main').innerHTML=`${pageHeading('Die Kasse.','Alles im Glas. Alles im Blick.')}<div id="team-event-notice"></div><div class="kasse-layout"><section class="catalog" aria-label="Artikel auswählen"><div class="quick-metrics"><div class="quick-metric"><div class="metric-label">${icon('chart')}Umsatz heute</div><strong id="today-total">—</strong></div><div class="quick-metric"><div class="metric-label">${icon('user')}Dein Umsatz heute</div><strong id="own-total">—</strong></div><div class="quick-metric"><div class="metric-label">${icon('receipt')}Verkäufe heute</div><strong id="today-count">—</strong></div></div><div id="stock-notice">${stockNotice()}</div><div class="catalog-header"><h2 class="section-title">Unsere Karte <span class="item-count">${state.products.length} Artikel</span></h2><div class="search">${icon('search')}<input id="article-search" type="search" placeholder="Artikel suchen …" aria-label="Artikel suchen" value="${esc(state.search)}"></div></div><div id="categories" class="categories" aria-label="Artikelkategorien"></div><div id="product-grid" class="product-grid"></div><p class="catalog-note">${icon('info')}Artikel auswählen, Menge angeben und zur Bestellung hinzufügen.</p></section><aside id="receipt" class="receipt" aria-label="Aktuelle Bestellung"></aside></div><div id="mobile-cart-bar" class="mobile-cart-bar"></div>`;
  renderCategories();renderProducts();renderCart();renderTeamEventNotice();
  $('#article-search').addEventListener('input',event=>{state.search=event.target.value;renderProducts();});
}
function renderCategories() {
  const categories=['Alle',...new Set(state.products.map(p=>p.category))];
  if(!categories.includes(state.category))state.category='Alle';
  $('#categories').innerHTML=categories.map(c=>`<button class="category ${state.category===c?'active':''}" data-action="category" data-category="${esc(c)}" aria-pressed="${state.category===c}">${esc(c)}</button>`).join('');
}
function renderProducts() {
  const products=state.products.filter(p=>(state.category==='Alle'||p.category===state.category)&&`${p.name} ${p.description} ${p.category}`.toLocaleLowerCase('de-DE').includes(state.search.toLocaleLowerCase('de-DE')));
  $('#product-grid').innerHTML=products.length?products.map(p=>`<button class="product" data-action="select-product" data-id="${esc(p.id)}" ${state.pending||p.stock_quantity===0?'disabled':''} aria-label="${esc(p.name)}, ${esc(money(p.price_cents))}, Menge auswählen"><span class="product-icon">${icon(categoryIcon(p.category))}</span><span class="product-copy"><span class="product-name">${esc(p.name)}</span><span class="product-desc">${esc(p.description)}</span>${stockBadge(p)}<span class="product-price">${money(p.price_cents)}</span></span><span class="product-plus">${icon('plus')}</span></button>`).join(''):`<div class="empty-state">${icon('search')}<h3>Hier ist es noch leer.</h3><p>${state.products.length?'Kein Artikel passt zu deiner Suche.':'Füge in der Verwaltung die ersten Artikel hinzu.'}</p></div>`;
}
function validDiscountPercent(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100&&Math.round(value*100)/100===value;}
const percentText=value=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(value);
function cartSubtotal(){return state.cart.reduce((sum,p)=>sum+p.quantity*p.price_cents,0);}
function cartDiscount(){return Math.round(cartSubtotal()*Math.round(state.discountPercent*100)/10000);}
function cartTotal(){return cartSubtotal()-cartDiscount();}
function updateCartTotals(){
  if($('#cart-subtotal'))$('#cart-subtotal').textContent=money(cartSubtotal());
  if($('#cart-discount-label'))$('#cart-discount-label').textContent='Rabatt ('+percentText(state.discountPercent)+' %)';
  if($('#cart-discount-amount'))$('#cart-discount-amount').textContent='− '+money(cartDiscount());
  if($('#cart-total'))$('#cart-total').textContent=money(cartTotal());
  if($('#checkout-button'))$('#checkout-button').disabled=!state.cart.length||state.busy||!state.discountValid;
  const mobileBar=$('#mobile-cart-bar'),count=state.cart.reduce((sum,p)=>sum+p.quantity,0);
  if(mobileBar)mobileBar.innerHTML=count?`<div><span class="mini-label">${count} Artikel in der Bestellung</span><strong class="mini-total">${money(cartTotal())}</strong></div><button class="button gold" data-action="show-cart">Bestellung ansehen ${icon('arrow')}</button>`:'';
}

function renderCart() {
  const receipt=$('#receipt');if(!receipt)return;
  const count=state.cart.reduce((sum,p)=>sum+p.quantity,0),locked=state.busy||!!state.pending;state.discountValid=true;
  receipt.innerHTML=`<div class="receipt-header"><div><div class="eyebrow">Gentlemans Bar</div><h2>Aktuelle Bestellung</h2></div><button class="icon-button" data-action="clear-cart" aria-label="Warenkorb leeren" title="Warenkorb leeren" ${!count||locked?'disabled':''}>${icon('trash')}</button></div><div class="receipt-employee">${icon('user')}Bedient von <strong>${esc(state.employee.name)}</strong></div><div class="cart-items">${state.cart.length?state.cart.map(p=>`<div class="cart-line"><div class="cart-line-top"><span>${esc(p.name)}</span><strong>${money(p.price_cents*p.quantity)}</strong></div><div class="cart-line-bottom"><span class="unit-price">${money(p.price_cents)} pro Stück</span><div class="line-controls"><div class="quantity-controls"><button data-action="cart-minus" data-id="${esc(p.id)}" aria-label="Menge von ${esc(p.name)} verringern" ${locked?'disabled':''}>${icon('minus')}</button><input data-cart-quantity="${esc(p.id)}" aria-label="Menge von ${esc(p.name)}" type="number" min="1" max="999" step="1" value="${p.quantity}" ${locked?'disabled':''}><button data-action="cart-plus" data-id="${esc(p.id)}" aria-label="Menge von ${esc(p.name)} erhöhen" ${locked||p.quantity>=999?'disabled':''}>${icon('plus')}</button></div><button class="icon-button" data-action="cart-remove" data-id="${esc(p.id)}" aria-label="${esc(p.name)} entfernen" ${locked?'disabled':''}>${icon('close')}</button></div></div></div>`).join(''):`<div class="cart-empty">${icon('cocktail')}<h3>Noch eine Runde?</h3><p>Wähle links einen Artikel aus.<br>Hier entsteht deine Bestellung.</p></div>`}</div><div class="receipt-summary"><div class="receipt-subtotal"><span>${count} ${count===1?'Artikel':'Artikel'} · ${state.cart.length} ${state.cart.length===1?'Position':'Positionen'}</span><span>${time(new Date())} Uhr</span></div><div class="receipt-value-line"><span>Zwischensumme</span><strong id="cart-subtotal">${money(cartSubtotal())}</strong></div><div class="receipt-discount-field"><label for="receipt-discount">Rabatt</label><div class="receipt-percent-input"><input id="receipt-discount" aria-label="Rabatt (%)" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${state.discountPercent}" required ${locked||!count?'disabled':''}><span>%</span></div></div><p id="receipt-discount-error" class="receipt-discount-error" role="alert"></p><div class="receipt-value-line receipt-discount-line"><span id="cart-discount-label">Rabatt (${percentText(state.discountPercent)} %)</span><strong id="cart-discount-amount">− ${money(cartDiscount())}</strong></div><div class="receipt-total"><span>Gesamt</span><strong id="cart-total" aria-live="polite">${money(cartTotal())}</strong></div><div class="payment-options" aria-label="Zahlungsart"><button class="payment-option ${state.payment==='cash'?'active':''}" data-action="payment" data-payment="cash" aria-pressed="${state.payment==='cash'}" ${locked?'disabled':''}>${icon('coin')}Bar</button><button class="payment-option ${state.payment==='card'?'active':''}" data-action="payment" data-payment="card" aria-pressed="${state.payment==='card'}" ${locked?'disabled':''}>${icon('card')}Karte</button></div>${state.pending?'<p class="pending-note">Der Buchungsstatus ist noch offen. Prüfe die Buchung erneut, bevor du weiterarbeitest.</p>':''}<button id="checkout-button" class="button gold full" data-action="checkout" ${!count||state.busy?'disabled':''}><span>${state.busy?'Wird gespeichert …':state.pending?'Buchung prüfen':'Verkauf buchen'}</span>${icon(state.busy?'clock':'arrow')}</button><p class="receipt-note">${state.lastOrder?`<button class="detail-button" data-action="order-details" data-id="${esc(state.lastOrder.id)}">Letzte Buchung · ${money(state.lastOrder.total_cents,state.lastOrder.currency)} ${icon('receipt')}</button>`:'Der Verkauf wird deinem Namen zugeordnet.'}</p></div>`;
  $('#receipt-discount').addEventListener('input',event=>{
    if(state.busy||state.pending)return;
    const input=event.currentTarget,percent=input.valueAsNumber;
    state.discountValid=input.validity.valid&&validDiscountPercent(percent);
    $('#receipt-discount-error').textContent=state.discountValid?'':'Bitte 0–100 % eingeben, mit höchstens zwei Nachkommastellen.';
    if(state.discountValid){state.discountPercent=percent;state.requestId=crypto.randomUUID();saveDraft();}
    updateCartTotals();
  });
  updateCartTotals();
}
async function refreshMetrics() {
  if(!can('cashier'))return;
  const result=await api('/cashier-summary');
  if($('#today-total')){$('#today-total').textContent=money(result.total_cents);$('#today-count').textContent=result.count;$('#own-total').textContent=money(result.own_total_cents);}
}
function openModal(content) {
  modal.innerHTML=content;if(!modal.open)modal.showModal();
}
function modalHead(title,subtitle='',eyebrow='Gentlemans Bar') {
  return `<div class="modal-head"><div><div class="eyebrow">${eyebrow}</div><h2 id="modal-title">${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div><button class="icon-button" data-action="close-modal" aria-label="Dialog schließen">${icon('close')}</button></div>`;
}
function selectProduct(id) {
  if(state.pending)return;
  const product=state.products.find(p=>p.id===id);if(!product)return;
  const existing=state.cart.find(p=>p.id===id),max=Math.min(999,product.stock_quantity)-(existing?.quantity||0);
  if(max<1){toast('Kein weiterer Bestand verfügbar.',true);return;}
  openModal(`${modalHead(product.name,product.description,'Zur Bestellung')}<form class="modal-body" id="quantity-form"><div class="modal-product"><div class="product-icon">${icon(categoryIcon(product.category))}</div><div class="price">${money(product.price_cents)}</div></div><label for="product-quantity">Wie viele dürfen es sein?</label><div class="large-stepper"><button type="button" data-action="modal-minus" aria-label="Menge verringern">${icon('minus')}</button><input id="product-quantity" type="number" min="1" max="${max}" value="1" required autofocus><button type="button" data-action="modal-plus" aria-label="Menge erhöhen">${icon('plus')}</button></div><button class="button gold full" type="submit"><span>Hinzufügen · <span id="add-price">${money(product.price_cents)}</span></span>${icon('plus')}</button></form>`);
  $('#product-quantity').addEventListener('input',()=>{$('#add-price').textContent=money(product.price_cents*(Number($('#product-quantity').value)||0));});
  $('#quantity-form').addEventListener('submit',event=>{
    event.preventDefault();const quantity=Number($('#product-quantity').value);
    if(!Number.isInteger(quantity)||quantity<1||quantity>max)return;
    if(existing){existing.quantity+=quantity;existing.name=product.name;existing.price_cents=product.price_cents;}else state.cart.push({...product,quantity});
    state.requestId=crypto.randomUUID();saveDraft();modal.close();renderCart();
  });
}
function changeCart(id,change) {
  if(state.pending||state.busy)return;
  const line=state.cart.find(p=>p.id===id);if(!line)return;
  const value=typeof change==='function'?change(line.quantity):change;
  if(!Number.isInteger(value)||value<0||value>999){toast('Bitte eine ganze Menge von 1 bis 999 eingeben.',true);renderCart();return;}
  const product=state.products.find(p=>p.id===id);
  if(value>0&&value>(product?.stock_quantity??0)){toast(`Nur noch ${product?.stock_quantity??0} Stück verfügbar.`,true);renderCart();return;}
  if(value===0)state.cart=state.cart.filter(p=>p.id!==id);else line.quantity=value;
  if(!state.cart.length)state.discountPercent=0;
  state.requestId=crypto.randomUUID();saveDraft();renderCart();
}
async function checkout() {
  if(state.busy||!state.cart.length)return;
  if(!state.discountValid||!validDiscountPercent(state.discountPercent)){toast('Bitte einen gültigen Rabatt von 0 bis 100 % eingeben.',true);$('#receipt-discount')?.focus();return;}
  state.busy=true;
  if(!state.pending)state.pending={id:state.requestId||crypto.randomUUID(),items:state.cart.map(p=>({productId:p.id,quantity:p.quantity,unitPriceCents:p.price_cents})),payment:state.payment,currency:state.config.currency,discount_percent:state.discountPercent};
  saveDraft();renderCart();renderProducts();
  let result;
  try{result=await api('/orders',{method:'POST',body:state.pending});}
  catch(error){
    if(error.status>=400&&error.status<500){state.pending=null;state.requestId=crypto.randomUUID();}
    state.busy=false;saveDraft();if(state.employee){renderCart();if($('#product-grid'))renderProducts();}toast(error.message,true);return;
  }
  state.busy=false;state.pending=null;state.cart=[];state.discountPercent=0;state.discountValid=true;state.requestId=crypto.randomUUID();state.lastOrder=result.order;saveDraft();
  try{state.products=(await api('/products')).products;refreshStockNotice();}catch{}
  renderCart();if($('#product-grid'))renderProducts();toast(`${money(result.order.total_cents,result.order.currency)} erfolgreich für ${state.employee.name} gebucht.`);
  refreshMetrics().catch(()=>toast('Verkauf gespeichert. Die Umsatzübersicht wird nach Wiederherstellung der Verbindung aktualisiert.',true));
}
async function renderStats(epoch) {
  $('#main').innerHTML=`${pageHeading('Der Überblick.','Jeder Verkauf zählt. Jeder im Team auch.','Zahlen & Team')}<div class="toolbar"><div class="periods" aria-label="Zeitraum">${[['today','Heute'],['week','7 Tage'],['month','Dieser Monat'],['all','Gesamt']].map(([p,label])=>`<button data-action="period" data-period="${p}" class="${state.period===p?'active':''}" aria-pressed="${state.period===p}">${label}</button>`).join('')}</div><div class="date-range"><input id="from-date" type="date" aria-label="Umsätze von" min="2000-01-01" max="2100-12-31" value="${state.from||''}"><span>bis</span><input id="to-date" type="date" aria-label="Umsätze bis" min="2000-01-01" max="2100-12-31" value="${state.to||''}"></div><div id="stats-currency" class="stats-currency hidden"></div><a class="button" href="/api/orders/export?${queryRange()}" download>${icon('download')}CSV exportieren</a></div><div id="stats-content"><div class="table-empty">Umsätze werden geladen …</div></div>`;
  for(const id of ['from-date','to-date'])$(`#${id}`).addEventListener('change',()=>{
    const from=$('#from-date').value,to=$('#to-date').value;
    if(from&&to&&from>to){toast('Das Enddatum muss nach dem Startdatum liegen.',true);return;}
    state.from=from||null;state.to=to||null;state.period='custom';renderPage();
  });
  try {
    const data=await api(`/stats?${queryRange()}`);if(epoch!==state.epoch||state.view!=='stats')return;
    state.statsCurrency=data.currency;
    if(data.currencies.length>1){
      const picker=$('#stats-currency');picker.classList.remove('hidden');
      picker.innerHTML=`<label for="stats-currency-select">Währung</label><select id="stats-currency-select">${data.currencies.map(c=>`<option value="${esc(c)}" ${c===data.currency?'selected':''}>${c==='USD'?'Dollar ($)':'Euro (€)'}</option>`).join('')}</select>`;
      $('#stats-currency-select').addEventListener('change',event=>{state.statsCurrency=event.target.value;renderPage();});
    }
    $('#stats-content').innerHTML=statsContent(data);
  }catch(error){if(epoch===state.epoch&&$('#stats-content'))$('#stats-content').innerHTML=`<div class="empty-state"><h3>Keine Verbindung zur Übersicht.</h3><p>${esc(error.message)}</p><br><button class="button" data-action="refresh">Erneut laden</button></div>`;}
}
function statsContent({currency,totals,employees,orders,bestsellers}) {
  const active=employees,max=Math.max(1,Number(totals.total_cents));
  const cards=[['Gesamtumsatz',money(totals.total_cents,currency),'chart','Im gewählten Zeitraum'],['Verkäufe',totals.count,'receipt','Erfolgreich gebuchte Bestellungen'],['Bar',money(totals.cash_cents,currency),'coin','Als Barzahlung erfasst'],['Karte',money(totals.card_cents,currency),'card','Als Kartenzahlung erfasst']];
  return `<div class="stat-cards">${cards.map(([label,value,name,hint])=>`<div class="stat-card"><div class="metric-label">${label}${icon(name)}</div><strong>${value}</strong><div class="helper">${hint}</div></div>`).join('')}</div><div class="stats-split"><section class="panel"><div class="panel-heading"><h2>Das Team</h2><span class="eyebrow">Umsatz pro Mitarbeiter</span></div>${active.length?`<div class="table-scroll"><table><thead><tr><th>Mitarbeiter</th><th class="right">Verkäufe</th><th class="right">Umsatz</th><th>Anteil</th></tr></thead><tbody>${active.map(e=>`<tr><td><div class="employee-cell"><span class="avatar">${esc(initials(e.name))}</span><span>${esc(e.name)}${e.id===state.employee.id?'<span class="you-tag">DU</span>':''}</span></div></td><td class="right">${e.count}</td><td class="right">${money(e.total_cents,currency)}</td><td><progress class="bar-meter" value="${Number(e.total_cents)}" max="${max}" aria-label="${esc(e.name)}: ${totals.total_cents>0?Math.round(Number(e.total_cents)/Number(totals.total_cents)*100):0} Prozent des Umsatzes"></progress></td></tr>`).join('')}</tbody></table></div>`:'<div class="table-empty">Noch keine Verkäufe in diesem Zeitraum.<br>Die erste Runde macht den Anfang.</div>'}</section><section class="panel"><div class="panel-heading"><h2>Die Favoriten</h2><span class="eyebrow">Meistverkauft</span></div>${bestsellers.length?`<div class="bestsellers">${bestsellers.map((b,i)=>`<div class="best-row"><span class="best-rank">${String(i+1).padStart(2,'0')}</span><span class="best-name">${esc(b.name)}<small>${money(b.total_cents,currency)} Umsatz</small></span><span class="best-number">${b.quantity} ×</span></div>`).join('')}</div>`:'<div class="table-empty">Deine beliebtesten Artikel<br>erscheinen nach den ersten Verkäufen.</div>'}</section></div><section class="panel"><div class="panel-heading"><h2>Letzte Buchungen</h2><button class="detail-button" data-action="refresh">${icon('clock')}Aktualisieren</button></div>${orders.length?`<div class="table-scroll"><table><thead><tr><th>Buchung</th><th>Datum / Uhrzeit</th><th>Mitarbeiter</th><th>Zahlung</th><th class="right">Betrag</th><th>Status</th><th></th></tr></thead><tbody>${orders.map(o=>`<tr><td><span class="order-id">#${esc(o.id.slice(0,8).toUpperCase())}</span></td><td>${date(o.created_at)} <span class="muted">· ${time(o.created_at)}</span></td><td>${esc(o.employee_name)}</td><td>${o.payment==='cash'?'Bar':'Karte'}</td><td class="right">${money(o.total_cents,o.currency)}</td><td><span class="badge ${o.voided_at?'void':''}">${o.voided_at?'Storniert':'Gebucht'}</span></td><td><button class="detail-button" data-action="order-details" data-id="${esc(o.id)}">Details ${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="table-empty">Hier findest du die Buchungen für den gewählten Zeitraum.</div>'}<div class="table-caption">Die neuesten 50 Buchungen im Zeitraum · Stornos sind aus allen Umsatzsummen herausgerechnet. Der CSV-Export enthält sämtliche Positionen, auch Stornos.</div></section>`;
}
async function renderAdmin(epoch) {
  $('#main').innerHTML=pageHeading('Die Karte.','Eure Artikel. Eure Preise. Euer Stil.','Sortiment & Verwaltung');
  try {
    const [{products},config]=await Promise.all([api('/products?all=true'),api('/config')]);
    if(epoch!==state.epoch||state.view!=='admin')return;state.allProducts=products;state.config=config;
    $('#main').insertAdjacentHTML('beforeend',`<div class="admin-top"><div class="currency-settings"><label for="currency">Währung der Kasse</label><select id="currency"><option value="EUR" ${config.currency==='EUR'?'selected':''}>Euro (€)</option><option value="USD" ${config.currency==='USD'?'selected':''}>Dollar ($)</option></select><button class="button" data-action="save-currency">Speichern</button></div><button class="button gold" data-action="add-product">${icon('plus')}Neuer Artikel</button></div><section class="panel"><div class="panel-heading"><h2>Das Sortiment</h2><span class="eyebrow">${products.length} Artikel</span></div><div class="table-scroll"><table class="admin-table"><thead><tr><th>Artikel</th><th>Kategorie</th><th class="right">Preis</th><th>Status</th><th></th></tr></thead><tbody>${products.map(p=>`<tr><td>${esc(p.name)}<div class="description-cell">${esc(p.description)}</div></td><td>${esc(p.category)}</td><td class="right">${money(p.price_cents)}</td><td><span class="badge ${p.active?'':'inactive'}">${p.active?'Aktiv':'Pausiert'}</span></td><td><div class="admin-actions"><button class="button" data-action="edit-product" data-id="${esc(p.id)}">${icon('edit')}Bearbeiten</button></div></td></tr>`).join('')}</tbody></table></div></section><p class="admin-note">Die Währung kann vor dem ersten Verkauf geändert werden. Pausierte Artikel verschwinden aus der Kasse. Bereits gebuchte Verkäufe behalten ihren ursprünglichen Preis.</p>`);
  }catch(error){if(epoch===state.epoch&&$('#main'))$('#main').insertAdjacentHTML('beforeend',`<div class="empty-state"><p>${esc(error.message)}</p><br><button class="button" data-action="refresh">Erneut laden</button></div>`);}
}
function productForm(id) {
  const p=id?state.allProducts.find(p=>p.id===id):{name:'',description:'',category:'Essen',price_cents:0,active:true};
  if(!p)return;
  openModal(`${modalHead(id?'Artikel bearbeiten':'Ein neuer Klassiker.','','Sortiment')}<form class="modal-body" id="product-form"><div class="field"><label for="product-name">Artikelname</label><input id="product-name" name="name" value="${esc(p.name)}" maxlength="60" required></div><div class="form-row"><div class="field"><label for="product-category">Kategorie</label><input id="product-category" name="category" list="category-suggestions" value="${esc(p.category)}" maxlength="30" required><datalist id="category-suggestions">${[...new Set(['Essen','Alkoholische Getränke','Alkoholfreie Getränke','Kaffeespezialitäten','Zigaretten & Zigarren','Spezielles','Shisha','Aromen',...state.allProducts.map(p=>p.category)])].map(c=>`<option value="${esc(c)}"></option>`).join('')}</datalist></div><div class="field"><label for="product-price">Preis (${state.config.currency==='EUR'?'€':'$'})</label><input id="product-price" name="price" type="text" inputmode="decimal" value="${(p.price_cents/100).toFixed(2).replace('.',',')}" placeholder="12,00" required></div></div><div class="field"><label for="product-purchase-price">Einkaufspreis ($)</label><input id="product-purchase-price" name="purchase_price" type="text" inputmode="decimal" value="${p.purchase_price_cents==null?'':(p.purchase_price_cents/100).toFixed(2).replace('.',',')}" placeholder="z. B. 100,00"><p class="helper">Für Einkäufe erforderlich. Leer lassen, wenn der Preis noch unbekannt ist.</p></div><div class="field"><label for="product-description">Beschreibung</label><input id="product-description" name="description" value="${esc(p.description)}" maxlength="120" placeholder="z. B. 4 cl · auf Eis"></div>${id?`<div class="field"><label for="product-active">Verfügbarkeit</label><select id="product-active" name="active"><option value="true" ${p.active?'selected':''}>Aktiv · in der Kasse anzeigen</option><option value="false" ${!p.active?'selected':''}>Pausiert · aus der Kasse ausblenden</option></select></div>`:''}<p id="product-error" class="error" role="alert"></p><div class="modal-actions"><button class="button" type="button" data-action="close-modal">Abbrechen</button><button class="button gold" type="submit">${icon('check')}Speichern</button></div></form>`);
  $('#product-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,price=form.elements.price.value.trim().replace(',','.');
    if(!/^\d{1,6}(\.\d{1,2})?$/.test(price)||Number(price)>100000){$('#product-error').textContent='Bitte einen Preis von 0 bis 100.000 mit höchstens zwei Nachkommastellen eingeben.';return;}
    const cost=form.elements.purchase_price.value.trim().replace(',','.');
    if(cost&&(!/^\d{1,6}(\.\d{1,2})?$/.test(cost)||Number(cost)<=0||Number(cost)>100000)){$('#product-error').textContent='Bitte einen Einkaufspreis größer als 0 bis 100.000 mit höchstens zwei Nachkommastellen eingeben.';return;}
    const button=$('button[type=submit]',form);button.disabled=true;
    const body={purchase_price_cents:cost?Math.round(Number(cost)*100):null,name:form.elements.name.value,category:form.elements.category.value,description:form.elements.description.value,price_cents:Math.round(Number(price)*100),active:form.elements.active?.value!=='false'};
    try{await api(id?`/products/${encodeURIComponent(id)}`:'/products',{method:id?'PUT':'POST',body});modal.close();toast('Artikel gespeichert.');state.products=(await api('/products')).products;renderPage();}catch(error){$('#product-error').textContent=error.message;button.disabled=false;}
  });
}
async function orderDetails(id) {
  try{
    const {order,items}=await api(`/orders/${encodeURIComponent(id)}`);
    openModal(`${modalHead('Buchung #'+order.id.slice(0,8).toUpperCase(),`${date(order.created_at)} · ${time(order.created_at)} Uhr`,'Buchungsdetails')}<div class="modal-body"><div class="detail-meta"><span>${esc(order.employee_name)}</span><span>${order.payment==='cash'?'Barzahlung':'Kartenzahlung'}</span></div>${items.map(i=>`<div class="detail-line"><span>${i.quantity} × ${esc(i.name)}<small>${money(i.price_cents,order.currency)} pro Stück</small></span><span>${money(i.price_cents*i.quantity,order.currency)}</span></div>`).join('')}${order.discount_basis_points>0?`<div class="detail-line"><span>Zwischensumme</span><strong>${money(order.total_cents+order.discount_cents,order.currency)}</strong></div><div class="detail-line detail-discount"><span>Rabatt (${percentText(order.discount_basis_points/100)} %)</span><strong>− ${money(order.discount_cents,order.currency)}</strong></div>`:''}<div class="detail-total"><span>Gesamt</span><strong>${money(order.total_cents,order.currency)}</strong></div>${order.voided_at?`<p class="void-note">Storniert am ${date(order.voided_at)} um ${time(order.voided_at)} Uhr.<br>Grund: ${esc(order.void_reason)}</p>`:`<div class="modal-actions"><button class="button danger" data-action="void-order" data-id="${esc(id)}">Buchung stornieren</button><button class="button" data-action="close-modal">Schließen</button></div>`}</div>`);
  }catch(error){toast(error.message,true);}
}
function voidForm(id) {
  openModal(`${modalHead('Buchung stornieren','Der Verkauf wird aus dem Umsatz herausgerechnet. Die Buchung bleibt nachvollziehbar.','Verwaltung')}<form class="modal-body" id="void-form"><div class="field"><label for="void-reason">Grund für das Storno</label><textarea id="void-reason" name="reason" rows="3" minlength="3" maxlength="200" placeholder="z. B. Bestellung versehentlich doppelt erfasst" required></textarea></div><p id="void-error" class="error" role="alert"></p><div class="modal-actions"><button class="button" type="button" data-action="close-modal">Abbrechen</button><button class="button danger" type="submit">Storno bestätigen</button></div></form>`);
  $('#void-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,button=$('button[type=submit]',form);button.disabled=true;
    try{
      await api(`/orders/${encodeURIComponent(id)}/void`,{method:'POST',body:{reason:form.elements.reason.value}});modal.close();state.products=(await api('/products')).products;toast('Buchung storniert. Umsatz und Lagerbestand wurden angepasst.');await renderPage();
    }catch(error){if($('#void-error'))$('#void-error').textContent=error.message;button.disabled=false;}
  });
}
async function action(button) {
  const name=button.dataset.action,id=button.dataset.id;
  switch(name){
    case 'navigate':if(state.busy)return;state.view=button.dataset.view;await renderPage();break;
    case 'reload':await startApp();break;
    case 'refresh':await renderPage();break;
    case 'logout':
      if(state.pending||state.busy||state.operationPending){toast('Bitte zuerst den offenen Buchungsstatus prüfen.',true);return;}
      saveDraft();await api('/logout',{method:'POST',body:{}});state.employee=null;state.epoch++;renderLogin();break;
    case 'category':state.category=button.dataset.category;renderCategories();renderProducts();break;
    case 'select-product':selectProduct(id);break;
    case 'close-modal':modal.close();break;
    case 'modal-minus':case 'modal-plus':{
      const input=$('#product-quantity');const n=Number(input.value)+(name==='modal-plus'?1:-1);input.value=Math.max(1,Math.min(Number(input.max),n));input.dispatchEvent(new Event('input'));break;
    }
    case 'cart-minus':changeCart(id,n=>n-1);break;
    case 'cart-plus':changeCart(id,n=>n+1);break;
    case 'cart-remove':changeCart(id,0);break;
    case 'clear-cart':
      openModal(`${modalHead('Neue Runde?','Alle Artikel werden aus der aktuellen Bestellung entfernt.')}<div class="modal-body"><div class="modal-actions"><button class="button" data-action="close-modal">Behalten</button><button class="button gold" data-action="confirm-clear">Warenkorb leeren</button></div></div>`);break;
    case 'confirm-clear':if(state.pending||state.busy)return;state.cart=[];state.discountPercent=0;state.discountValid=true;state.requestId=crypto.randomUUID();saveDraft();modal.close();renderCart();break;
    case 'payment':if(state.pending||state.busy)return;state.payment=button.dataset.payment;saveDraft();renderCart();break;
    case 'checkout':await checkout();break;
    case 'show-cart':$('#receipt')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});break;
    case 'period':setPeriod(button.dataset.period);await renderPage();break;
    case 'add-product':productForm();break;
    case 'edit-product':productForm(id);break;
    case 'save-currency':{
      const currency=$('#currency').value;const result=await api('/settings',{method:'PUT',body:{currency}});
      state.config.currency=result.currency;toast('Währung gespeichert.');await renderPage();break;
    }
    case 'order-details':await orderDetails(id);break;
    case 'void-order':voidForm(id);break;
    case 'adjust-stock':stockForm(id);break;
    case 'new-rental':rentalForm(button.dataset.space);break;
    case 'new-event':eventForm();break;
    case 'edit-event':eventForm(id);break;
    case 'event-details':eventDetails(id);break;
    case 'delete-event':deleteEventForm(id);break;
    case 'void-admission':reasonOperation('Eintritt stornieren',`/admissions/${encodeURIComponent(id)}/void`,'Die Eintrittseinnahme und der zugehörige Geldbestand werden korrigiert.');break;
    case 'cancel-rental':reasonOperation('Vermietung stornieren',`/rentals/${encodeURIComponent(id)}/cancel`,'Nur diese Vermietung und ihre Mieteinnahme werden storniert. Andere Gäste bleiben gebucht.');break;
    case 'new-finance':financeForm(button.dataset.kind);break;
    case 'wallet-transfer':walletForm('transfer',button.dataset.account);break;
    case 'wallet-adjust':walletForm('adjustment',button.dataset.account);break;
    case 'edit-employee':employeeForm(id);break;
    case 'kick-employee':employeeAccessForm('kick',id);break;
    case 'end-employee-sessions':employeeAccessForm('sessions',id);break;
    case 'restore-employee':employeeAccessForm('restore',id);break;
    case 'deactivate-employee':employeeAccessForm('deactivate',id);break;
    case 'activate-employee':employeeAccessForm('activate',id);break;
    case 'void-finance':reasonOperation('Finanzbuchung stornieren',`/finance/${encodeURIComponent(id)}/void`,'Der Eintrag bleibt nachvollziehbar und wird aus den Summen herausgerechnet.');break;
    case 'resume-operation':resumeOperation();break;
    case 'buy-minus':changePurchase(id,n=>Math.max(0,n-1));break;
    case 'buy-plus':changePurchase(id,n=>Math.min(100000,n+1));break;
    case 'purchase-details':await purchaseDetails(id);break;
    case 'void-purchase':reasonOperation('Einkauf stornieren',`/purchases/${encodeURIComponent(id)}/void`,'Die Menge wird aus dem Lager entfernt und die Ausgabe storniert. Der Bestand muss dafür noch ausreichen.');break;
  }
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  action(button).catch(error=>toast(error.message,true));
});
document.addEventListener('change',event=>{
  const id=event.target.dataset.cartQuantity;
  if(id){const quantity=Number(event.target.value);if(quantity<1){toast('Zum Entfernen bitte das × verwenden.',true);renderCart();return;}changeCart(id,quantity);}
});
modal.addEventListener('click',event=>{if(event.target===modal){const rect=modal.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)modal.close();}});
window.addEventListener('online',()=>{if(state.employee)refreshMetrics().catch(()=>{});});
window.addEventListener('offline',()=>connection(false));
setInterval(async()=>{
  if(!state.employee||document.hidden||state.busy)return;
  try{
    const me=await api('/me');updateEmployeeHeader(me.employee);
    if(modal.open)return;
    if(!can('cashier')){if(state.view==='entrance')await renderPage();return;}
    const {products}=await api('/products');
    const newlyLow=products.filter(p=>p.stock_quantity<30&&state.products.find(old=>old.id===p.id)?.stock_quantity>=30);
    const changed=JSON.stringify(products)!==JSON.stringify(state.products);
    state.products=products;
    if(newlyLow.length)toast(`Lager unter 30 Stück: ${newlyLow.map(p=>`${p.name} (${p.stock_quantity})`).join(' · ')}`,true);
    if(state.view==='kasse'){
      await refreshMetrics();
      if(changed&&$('#product-grid')){renderCategories();renderProducts();refreshStockNotice();}
    }
    if(state.view==='inventory'&&changed){
      const search=$('#stock-search')?.value||'',only=$('#only-low')?.checked||false;
      await renderPage();
      if($('#stock-search')){$('#stock-search').value=search;$('#only-low').checked=only;$('#stock-search').dispatchEvent(new Event('input'));}
    }
    if(state.view==='wallet'||state.view==='employees'||state.view==='events'||state.view==='entrance')await renderPage();
  }catch{}
},30000);
async function initialize() {
  setPeriod('today');
  try{
    state.config=await api('/config');
    try{const me=await api('/me');state.employee=me.employee;}catch(error){if(error.status!==401)throw error;}
    if(state.employee){restoreDraft();await startApp();}else renderLogin();
  }catch(error){
    $('#app').innerHTML=`<main class="fatal-error"><h1>Die Bar ist noch nicht erreichbar.</h1><p>${esc(error.message)}</p><button class="button gold" id="retry-connect">Erneut verbinden</button></main>`;
    $('#retry-connect').addEventListener('click',initialize);
  }
}
initialize();
