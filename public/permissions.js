const navigationItems=[['kasse','register','Kasse','cashier'],['entrance','ticket','Eintritt','entrance'],['stats','chart','Umsätze','sales'],['payroll','coin','Löhne','payroll'],['employee-statistics','chart','Statistiken','statistics'],['inventory','box','Lager','inventory'],['purchases','download','Einkauf','purchases'],['vip','wine','VIP','vip'],['events','calendar','Events','events'],['finance','coin','Finanzen','finance'],['wallet','register','Kassenstand','wallet'],['employees','user','Mitarbeiter','employees'],['admin','edit','Sortiment','assortment']];
const can=permission=>!!state.employee?.permissions?.[permission];
const homeView=()=>navigationItems.find(([,,,permission])=>can(permission))?.[0]||'home';
const allowedView=view=>view==='home'?homeView()==='home':navigationItems.some(([key,,,permission])=>key===view&&can(permission));
function navigationMarkup(){return navigationItems.filter(([,,,permission])=>can(permission)).map(([view,drawing,label])=>`<button data-action="navigate" data-view="${view}" class="${state.view===view?'active':''}" ${state.view===view?'aria-current="page"':''}>${icon(drawing)}${label}</button>`).join('');}
function syncRoleNavigation(){
  const nav=$('.nav');if(!nav)return;nav.innerHTML=navigationMarkup();
  if(!allowedView(state.view))state.view=homeView();
  if(modal.open)modal.close();
  renderPage().catch(error=>toast(error.message,true));
}
function renderNoAccess(){
  $('#main').innerHTML=`${pageHeading('Willkommen im Team.','Deine Stempeluhr bleibt oben erreichbar.','Dein Zugang')}<section class="panel no-access-panel"><h2>Noch keine Seiten freigegeben</h2><p>Ein Inhaber oder Manager kann dir unter Mitarbeiter die benötigten Bereiche freigeben.</p></section>`;
}
async function renderTeamEventNotice(){
  const target=$('#team-event-notice');if(!target)return;if(!can('teamEvents')){target.innerHTML='';return;}
  try{
    const {events}=await api('/events');if(!target.isConnected)return;
    const upcoming=events.filter(event=>eventStatus(event)[0]!=='Vergangen').slice(0,3);
    target.innerHTML=upcoming.length?`<details class="team-event-notice"><summary>${icon('calendar')}Nächste Events fürs Team <span>${upcoming.length}</span></summary><div>${upcoming.map(event=>`<article><strong>${esc(event.title)}</strong><span>${esc(eventTimeRange(event))}</span>${event.description?`<p>${esc(event.description)}</p>`:''}</article>`).join('')}</div></details>`:'';
  }catch{}
}
