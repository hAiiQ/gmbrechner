const navigationItems=[['kasse','register','Kasse','cashier'],['entrance','ticket','Eintritt','entrance'],['stats','chart','Umsätze','manage'],['inventory','box','Lager','manage'],['purchases','download','Einkauf','manage'],['vip','wine','VIP','manage'],['events','calendar','Events','manage'],['finance','coin','Finanzen','manage'],['wallet','register','Kassenstand','manage'],['employees','user','Mitarbeiter','manage'],['admin','edit','Sortiment','manage']];
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
