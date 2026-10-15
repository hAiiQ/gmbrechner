const navigationItems=[['kasse','register','Kasse','cashier'],['entrance','ticket','Eintritt','entrance'],['stats','chart','Umsätze','manage'],['payroll','coin','Löhne','payroll'],['employee-statistics','chart','Statistiken','statistics'],['inventory','box','Lager','operations'],['purchases','download','Einkauf','operations'],['vip','wine','VIP','operations'],['events','calendar','Events','operations'],['finance','coin','Finanzen','manage'],['wallet','register','Kassenstand','manage'],['employees','user','Mitarbeiter','operations'],['admin','edit','Sortiment','operations']];
const can=permission=>!!state.employee?.permissions?.[permission];
const homeView=()=>can('cashier')?'kasse':'entrance';
const allowedView=view=>navigationItems.some(([key,,,permission])=>key===view&&can(permission));
function navigationMarkup(){return navigationItems.filter(([,,,permission])=>can(permission)).map(([view,drawing,label])=>`<button data-action="navigate" data-view="${view}" class="${state.view===view?'active':''}" ${state.view===view?'aria-current="page"':''}>${icon(drawing)}${label}</button>`).join('');}
function syncRoleNavigation(){
  const nav=$('.nav');if(nav)nav.innerHTML=navigationMarkup();
  if(!allowedView(state.view)){state.view=homeView();if(modal.open)modal.close();renderPage().catch(error=>toast(error.message,true));}
}
async function renderTeamEventNotice(){
  const target=$('#team-event-notice');if(!target)return;
  try{
    const {events}=await api('/events');if(!target.isConnected)return;
    const upcoming=events.filter(event=>eventStatus(event)[0]!=='Vergangen').slice(0,3);
    target.innerHTML=upcoming.length?`<details class="team-event-notice"><summary>${icon('calendar')}Nächste Events fürs Team <span>${upcoming.length}</span></summary><div>${upcoming.map(event=>`<article><strong>${esc(event.title)}</strong><span>${esc(eventTimeRange(event))}</span>${event.description?`<p>${esc(event.description)}</p>`:''}</article>`).join('')}</div></details>`:'';
  }catch{}
}
