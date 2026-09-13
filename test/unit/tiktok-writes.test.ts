import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {collect,allTools,writeToolNames} from './catalogue';
import {tiktokWriteApi} from '../../src/platforms/tiktok/write-api';
import {TIKTOK_EXTENDED_WRITES} from '../../src/platforms/tiktok/extended-writes';
const config={accessToken:'secret-fixture',tiktokEnvironment:'sandbox',sandboxAdvertiserId:'123'};
const group={campaign_id:'200',adgroup_name:'Test group',promotion_type:'WEBSITE',optimization_goal:'CLICK',billing_event:'CPC',budget_mode:'BUDGET_MODE_DAY',budget:50,pacing:'PACING_MODE_SMOOTH',location_ids:['6252001'],schedule_type:'SCHEDULE_FROM_NOW',schedule_start_time:'2027-01-05T10:00:00-05:00'};
const creative={ad_name:'Business ad name',ad_format:'SINGLE_VIDEO',video_id:'video-file',display_name:'Test',landing_page_url:'https://example.com'};
const cases:[string,any][]=[
 ['tiktok_create_campaign_advanced',{configuration:{campaign_name:'Campaign',objective_type:'TRAFFIC',budget:100,budget_mode:'BUDGET_MODE_DAY'},currency:'USD'}],
 ['tiktok_update_campaign_configuration',{configuration:{campaign_id:'200',campaign_name:'Campaign'}}],
 ['tiktok_create_adgroup',{configuration:group,currency:'USD'}],
 ['tiktok_update_adgroup_configuration',{configuration:{adgroup_id:'300',age_groups:['AGE_25_34']}}],
 ['tiktok_create_ads',{configuration:{adgroup_id:'300',creatives:[creative]}}],
 ['tiktok_update_ads',{configuration:{adgroup_id:'300',creatives:[{ad_id:'500',ad_name:'Renamed'}]}}],
 ['tiktok_create_smart_plus_campaign',{configuration:{campaign_name:'Smart',objective_type:'WEB_CONVERSIONS',sales_destination:'WEBSITE',budget:100,request_id:'1770000000000001'},currency:'USD'}],
 ['tiktok_update_smart_plus_campaign',{configuration:{campaign_id:'200',campaign_name:'Smart renamed'}}],
 ['tiktok_create_smart_plus_adgroup',{configuration:{...Object.fromEntries(Object.entries(group).filter(([k])=>!['location_ids','pacing'].includes(k))),targeting_spec:{location_ids:['6252001']},request_id:'1770000000000002'},currency:'USD'}],
 ['tiktok_update_smart_plus_adgroup',{configuration:{adgroup_id:'300',adgroup_name:'Smart group'}}],
 ['tiktok_create_smart_plus_ad',{configuration:{ad_name:'Smart ad',adgroup_id:'300',creative_list:[{creative_info:{ad_format:'SINGLE_VIDEO',video_info:{video_id:'video-file'}}}]}}],
 ['tiktok_update_smart_plus_ad',{configuration:{smart_plus_ad_id:'500',ad_name:'Smart renamed'}}],
 ...['tiktok_update_ad_status','tiktok_update_smart_plus_ad_status'].map(n=>[n,{entityId:'500',status:'DISABLE'}] as [string,any]),
 ['tiktok_update_smart_plus_campaign_status',{entityId:'200',status:'DISABLE'}],
 ['tiktok_update_smart_plus_adgroup_status',{entityId:'300',status:'DISABLE'}],
 ['tiktok_update_smart_plus_material_status',{smartPlusAdId:'500',materialIds:['600'],status:'DISABLE'}],
 ...['campaign','adgroup','ad'].map((n,i)=>[`tiktok_rename_${n}`,{entityId:['200','300','500'][i],name:'New business name'}] as [string,any]),
 ...['image','video'].map(n=>[`tiktok_upload_ad_${n}`,{bytesBase64:'aGVsbG8=',fileName:`test.${n==='image'?'png':'mp4'}`}] as [string,any]),
];
let requests:{url:URL,method:string,body:any,headers:any}[];let overrides:Record<string,any>;
const run=async(name:string,args:any,conf=config)=>{const r=await collect('tiktok_ads',conf).find(t=>t.name===name)!.handler({advertiserId:'123',...args}) as any;try{return {...JSON.parse(r.content[0].text),isError:r.isError};}catch{return {error:r.content[0].text,isError:r.isError};}};
beforeEach(()=>{requests=[];overrides={};vi.stubGlobal('fetch',vi.fn(async(input:any,init:any={})=>{
 const url=new URL(String(input)),method=init.method||'GET',body=init.body instanceof FormData?init.body:init.body?JSON.parse(init.body):null;requests.push({url,method,body,headers:init.headers});
 const data=url.pathname.endsWith('/advertiser/info/')?{list:[{advertiser_id:'123',name:'Acme Company',currency:'USD',timezone:'Etc/GMT+5'}]}:method==='POST'?{campaign_id:'200',adgroup_id:'300',ad_ids:['500'],smart_plus_ad_id:'500'}:{list:[{advertiser_id:'123',campaign_id:'200',adgroup_id:'300',ad_id:'500',smart_plus_ad_id:'500',creative_list:[{ad_material_id:'600',material_operation_status:'DISABLE'}],operation_status:'DISABLE',budget_optimize_on:false,budget:50,schedule_start_time:'2027-01-05 15:00:00',schedule_end_time:'2027-02-05 15:00:00'}]};
 return new Response(JSON.stringify(overrides[method+':'+url.pathname]||{code:0,data,request_id:'fixture'}),{status:200});
}));});
afterEach(()=>vi.unstubAllGlobals());
it.each(cases)('%s previews without contacting any account',async(n,a)=>{const r=await run(n,a);expect(r.error).toBeUndefined();expect(r.applied).toBe(false);expect(r.environment).toBe('sandbox');expect(requests).toHaveLength(0);expect(JSON.stringify(r)).not.toContain('secret-fixture');});
it.each(cases)('%s scopes and performs one sandbox mutation',async(n,a)=>{const r=await run(n,{...a,confirm:true});expect(r.error).toBeUndefined();expect(r.applied).toBe(true);expect(requests.filter(x=>x.method==='POST')).toHaveLength(1);expect(requests.every(x=>x.url.hostname==='sandbox-ads.tiktok.com')).toBe(true);expect(requests[0].url.pathname).toContain('/advertiser/info/');});
it('classifies every added write correctly',()=>{expect(cases.map(([n])=>n).sort()).toEqual([...TIKTOK_EXTENDED_WRITES].sort());expect(TIKTOK_EXTENDED_WRITES.every(n=>writeToolNames('tiktok_ads').includes(n))).toBe(true);expect(allTools().find(x=>x.name==='tiktok_get_write_context')?.write).toBe(false);});
it('forces disabled creation on every regular creative',async()=>{await run('tiktok_create_ads',{...cases[4][1],confirm:true});expect(requests.find(x=>x.method==='POST')?.body.creatives[0].operation_status).toBe('DISABLE');});
it('uses smart_plus_ad_ids for native Smart+ filtering and status',async()=>{await run('tiktok_update_smart_plus_ad_status',{entityId:'500',status:'DISABLE',confirm:true});expect(requests.find(r=>r.method==='POST')?.body.smart_plus_ad_ids).toEqual(['500']);const get=requests.find(r=>r.url.pathname.endsWith('/smart_plus/ad/get/'))!;expect(JSON.parse(get.url.searchParams.get('filtering')!)).toEqual({smart_plus_ad_ids:['500'],primary_status:'STATUS_ALL'});});
it('converts offsets to native UTC while preserving major currency units',async()=>{const r=await run('tiktok_create_adgroup',cases[2][1]);expect(r.payload.schedule_start_time).toBe('2027-01-05 15:00:00');expect(r.payload.budget).toBe(50);});
it.each([
 {currency:undefined},{configuration:{...group,operation_status:'ENABLE'}},{configuration:{...group,advertiser_id:'999'}},
 {configuration:{...group,schedule_start_time:'2027-01-01T10:00:00'}},{configuration:{...group,schedule_start_time:'2027-02-30 10:00:00'}},
 {configuration:{...group,schedule_end_time:'2026-01-01 10:00:00'}},{configuration:{...group,schedule_start_time:'2027-02-30T10:00:00-05:00'}},{configuration:{...group,schedule_type:'SCHEDULE_START_END'}},
 {configuration:{...group,dayparting:'1'}},{configuration:{...group,billing_event:'CPM'}},
 {configuration:{...group,bid_type:'BID_TYPE_NO_BID',bid_price:10}},{configuration:{...group,location_ids:[]}},{configuration:{...group,unknown_field:'reject'}},
])('rejects incompatible or unsafe parameters without API calls',async patch=>{expect((await run('tiktok_create_adgroup',{...cases[2][1],confirm:true,...patch})).error).toBeTruthy();expect(requests).toHaveLength(0);});
it('never falls back to production for incorrect sandbox settings or scope',async()=>{expect(()=>tiktokWriteApi({...config,tiktokEnvironment:'typo'})).toThrow();expect((await run('tiktok_create_adgroup',{...cases[2][1],advertiserId:'999',confirm:true})).error).toContain('Sandbox');expect((await run('tiktok_create_adgroup',{...cases[2][1],confirm:true},{...config,sandboxAdvertiserId:''})).error).toContain('Sandbox');expect(requests).toHaveLength(0);});
it('rejects foreign parent objects before mutation',async()=>{overrides['GET:/open_api/v1.3/campaign/get/']={code:0,data:{list:[{campaign_id:'200',advertiser_id:'999'}]}};expect((await run('tiktok_create_adgroup',{...cases[2][1],confirm:true})).error).toContain('Cannot verify');expect(requests.every(r=>r.method==='GET')).toBe(true);});
it('rejects CBO/ad group budget conflicts',async()=>{overrides['GET:/open_api/v1.3/campaign/get/']={code:0,data:{list:[{campaign_id:'200',advertiser_id:'123',budget_optimize_on:true}]}};expect((await run('tiktok_create_adgroup',{...cases[2][1],confirm:true})).error).toContain('omit');expect(requests.every(r=>r.method==='GET')).toBe(true);});
it('checks real account currency',async()=>{expect((await run('tiktok_create_adgroup',{...cases[2][1],currency:'EUR',confirm:true})).error).toContain('USD');expect(requests.every(r=>r.method==='GET')).toBe(true);});
it('computes upload MD5 and sends multipart without echoing media',async()=>{const a={bytesBase64:'aGVsbG8=',fileName:'test.mp4'};expect(JSON.stringify(await run('tiktok_upload_ad_video',a))).not.toContain('aGVsbG8=');await run('tiktok_upload_ad_video',{...a,confirm:true});const post=requests.find(r=>r.method==='POST')!;expect(post.body).toBeInstanceOf(FormData);expect(post.body.get('video_signature')).toBe('5d41402abc4b2a76b9719d911017c592');expect(post.body.get('video_file')).toBeInstanceOf(Blob);expect(post.headers['content-type']).toBeUndefined();});
it('surfaces TikTok application errors despite HTTP 200',async()=>{overrides['POST:/open_api/v1.3/campaign/create/']={code:40002,message:'Invalid objective'};expect(await run('tiktok_create_campaign_advanced',{...cases[0][1],confirm:true})).toMatchObject({isError:true,code:40002,outcome:'not_applied'});});
it('does not retry ambiguous POSTs',async()=>{const orig=fetch;vi.stubGlobal('fetch',vi.fn((u:any,i:any)=>i?.method==='POST'?Promise.reject(new Error('network')):orig(u,i)));expect(await run('tiktok_create_campaign_advanced',{...cases[0][1],confirm:true})).toMatchObject({outcome:'unknown',retrySafe:false});});
it('distinguishes acknowledged writes from failed readback',async()=>{overrides['GET:/open_api/v1.3/campaign/get/']={code:0,data:{list:[]}};const r=await run('tiktok_create_campaign_advanced',{...cases[0][1],confirm:true});expect(r.applied).toBe(true);expect(r.verification.confirmed).toBe(false);});
it('checks actual ad group membership on ad updates',async()=>{overrides['GET:/open_api/v1.3/ad/get/']={code:0,data:{list:[{ad_id:'500',advertiser_id:'123',adgroup_id:'777'}]}};expect((await run('tiktok_update_ads',{...cases[5][1],confirm:true})).error).toContain('declared ad group');expect(requests.every(r=>r.method==='GET')).toBe(true);});

it.each(['tiktok_update_adgroup_configuration','tiktok_update_adgroup_budget'])('checks the existing parent budget on %s',async name=>{overrides['GET:/open_api/v1.3/campaign/get/']={code:0,data:{list:[{campaign_id:'200',advertiser_id:'123',budget_optimize_on:true}]}};const args=name==='tiktok_update_adgroup_budget'?{adGroupId:'300',budget:60}:{configuration:{adgroup_id:'300',budget:60},currency:'USD'};expect((await run(name,{...args,confirm:true})).error).toContain('Campaign budget');expect(requests.every(r=>r.method==='GET')).toBe(true);});
it('preserves uncertain outcomes on legacy mutations',async()=>{const orig=fetch;vi.stubGlobal('fetch',vi.fn((u:any,i:any)=>i?.method==='POST'?Promise.reject(new Error('network')):orig(u,i)));expect(await run('tiktok_update_campaign_budget',{campaignId:'200',budget:100,confirm:true})).toMatchObject({isError:true,outcome:'unknown',retrySafe:false});});

it('rejects a lifetime ad group under a daily-budget campaign',async()=>{overrides['GET:/open_api/v1.3/campaign/get/']={code:0,data:{list:[{campaign_id:'200',advertiser_id:'123',budget_mode:'BUDGET_MODE_DAY'}]}};expect((await run('tiktok_create_adgroup',{...cases[2][1],configuration:{...group,budget_mode:'BUDGET_MODE_TOTAL'},confirm:true})).error).toContain('daily-budget');expect(requests.every(r=>r.method==='GET')).toBe(true);});

it.each([
 {ad_format:'SINGLE_IMAGE',image_ids:['image-1'],identity_type:'CUSTOM',identity_id:'700'},
 {ad_format:'CAROUSEL_ADS',image_ids:['image-1','image-2'],music_id:'music-1',identity_type:'CUSTOM',identity_id:'700'},
 {ad_format:'SINGLE_VIDEO',tiktok_item_id:'800',identity_type:'AUTH_CODE',identity_id:'700'},
 {ad_format:'SINGLE_VIDEO',tiktok_item_id:'800',identity_type:'BC_AUTH_TT',identity_id:'700',identity_authorized_bc_id:'900'},
])('preserves classic format and identity fields %j',async media=>{
 const expected={ad_name:'Exact Business Manager name',...media};
 const r=await run('tiktok_create_ads',{configuration:{adgroup_id:'300',creatives:[expected]}});
 expect(r.error).toBeUndefined();expect(r.payload.creatives[0]).toEqual({...expected,operation_status:'DISABLE'});expect(requests).toHaveLength(0);
 await run('tiktok_create_ads',{configuration:{adgroup_id:'300',creatives:[expected]},confirm:true});
 expect(requests.find(r=>r.method==='POST')?.body.creatives[0]).toEqual({...expected,operation_status:'DISABLE'});
});
it.each([
 {ad_format:'SINGLE_IMAGE',image_info:[{web_uri:'image-1'}]},
 {ad_format:'CAROUSEL_ADS',image_info:[{web_uri:'image-1'},{web_uri:'image-2'}]},
 {ad_format:'SINGLE_VIDEO',tiktok_item_id:'800',identity_type:'AUTH_CODE',identity_id:'700'},
 {ad_format:'SINGLE_VIDEO',video_info:{video_id:'video-1'},identity_type:'CUSTOM',identity_id:'700'},
])('preserves Smart+ media structure %j',async creative_info=>{
 const r=await run('tiktok_create_smart_plus_ad',{configuration:{ad_name:'Exact business name',adgroup_id:'300',creative_list:[{creative_info}]}});
 expect(r.error).toBeUndefined();expect(r.payload.operation_status).toBe('DISABLE');expect(r.payload.creative_list[0].creative_info).toEqual(creative_info);expect(requests).toHaveLength(0);
});
it('requires currency even when only a nested keyword bid changes',async()=>{
 const configuration={adgroup_id:'300',search_keywords:[{keyword:'analytics',keyword_bid:2,match_type:'BROAD_WORD'}]};
 expect((await run('tiktok_update_adgroup_configuration',{configuration,confirm:true})).error).toContain('currency');expect(requests).toHaveLength(0);
 const good=await run('tiktok_update_adgroup_configuration',{configuration,currency:'USD',confirm:true});expect(good.applied).toBe(true);expect(requests.find(r=>r.method==='POST')?.body.search_keywords[0].keyword_bid).toBe(2);
});
it('rejects negative keyword bids before all network calls',async()=>{expect((await run('tiktok_update_adgroup_configuration',{configuration:{adgroup_id:'300',search_keywords:[{keyword:'analytics',keyword_bid:-2}]},currency:'USD',confirm:true})).error).toContain('non-negative');expect(requests).toHaveLength(0);});
it('rejects non-native keyword match enums before network calls',async()=>{expect((await run('tiktok_update_adgroup_configuration',{configuration:{adgroup_id:'300',search_keywords:[{keyword:'analytics',match_type:'BROAD'}]},confirm:true})).error).toBeTruthy();expect(requests).toHaveLength(0);});
it.each(['BROAD_WORD','PHRASE_WORD','PRECISE_WORD'])('accepts the native keyword match %s',async match_type=>{const r=await run('tiktok_update_adgroup_configuration',{configuration:{adgroup_id:'300',search_keywords:[{keyword:'analytics',match_type}]}});expect(r.error).toBeUndefined();expect(r.payload.search_keywords[0].match_type).toBe(match_type);expect(requests).toHaveLength(0);});
it('never follows a provider recommendation to change the sandbox host',async()=>{overrides['POST:/open_api/v1.3/campaign/create/']={code:40010,message:'Please use business-api.tiktok.com with v1.3'};const r=await run('tiktok_create_campaign_advanced',{...cases[0][1],confirm:true});expect(r.code).toBe(40010);expect(requests.filter(x=>x.method==='POST')).toHaveLength(1);expect(requests.every(x=>x.url.hostname==='sandbox-ads.tiktok.com')).toBe(true);expect(vi.mocked(fetch).mock.calls.every(([,init])=>init?.redirect==='error')).toBe(true);});
it('stops a redirect after one request and preserves an uncertain write outcome',async()=>{
 vi.mocked(fetch).mockResolvedValueOnce(new Response(null,{status:302,headers:{location:'https://business-api.tiktok.com/open_api/v1.3/campaign/create/'}}));
 await expect(tiktokWriteApi(config).call('campaign/create/','POST',{advertiser_id:'123'})).rejects.toMatchObject({outcome:'unknown'});
 expect(fetch).toHaveBeenCalledTimes(1);expect(vi.mocked(fetch).mock.calls[0][1]?.redirect).toBe('error');
});
const smartWeb={campaign_name:'Smart+ exact name',objective_type:'WEB_CONVERSIONS',sales_destination:'WEBSITE',budget:100,request_id:'1770000000000001'};
it.each(['6ea500d4-1510-4eee-8192-767919c70935','9223372036854775808','-1','1.5'])('rejects invalid Smart+ campaign request_id %s without a native call',async request_id=>{const r=await run('tiktok_create_smart_plus_campaign',{configuration:{...smartWeb,request_id},currency:'USD',confirm:true});expect(r.error).toBeTruthy();expect(requests).toHaveLength(0);});
it('rejects UUID request IDs on Smart+ ad groups as well',async()=>{const args=cases.find(([n])=>n==='tiktok_create_smart_plus_adgroup')![1];expect((await run('tiktok_create_smart_plus_adgroup',{...args,configuration:{...args.configuration,request_id:'not-a-numeric-id'},confirm:true})).error).toBeTruthy();expect(requests).toHaveLength(0);});
it('shows the actual Smart+ CBO and dynamic daily defaults in the preview',async()=>{const r=await run('tiktok_create_smart_plus_campaign',{configuration:smartWeb,currency:'USD'});expect(r.error).toBeUndefined();expect(r.payload).toMatchObject({budget_optimize_on:true,budget_mode:'BUDGET_MODE_DYNAMIC_DAILY_BUDGET',budget:100,operation_status:'DISABLE',request_id:smartWeb.request_id});expect(requests).toHaveLength(0);});
it.each([
 [{...smartWeb,sales_destination:undefined},'sales_destination'],
 [{...smartWeb,objective_type:'APP_PROMOTION',app_promotion_type:undefined},'app_promotion_type'],
 [{...smartWeb,budget:undefined},'positive'],
 [{...smartWeb,budget_mode:'BUDGET_MODE_DAY'},'incompatible'],
 [{...smartWeb,budget_optimize_on:false,budget_mode:'BUDGET_MODE_DYNAMIC_DAILY_BUDGET'},'incompatible'],
 [{...smartWeb,is_search_campaign:true},'Search'],
])('rejects inconsistent Smart+ campaign settings %j',async(configuration,fragment)=>{expect((await run('tiktok_create_smart_plus_campaign',{configuration,currency:'USD',confirm:true})).error).toContain(fragment);expect(requests).toHaveLength(0);});
it('exposes upgraded Search independently of classic Traffic Search',async()=>{const configuration={...smartWeb,is_search_campaign:true,budget_optimize_on:false};const r=await run('tiktok_create_smart_plus_campaign',{configuration,currency:'USD'});expect(r.error).toBeUndefined();expect(r.payload).toMatchObject({is_search_campaign:true,budget_optimize_on:false,budget_mode:'BUDGET_MODE_INFINITE'});expect(requests).toHaveLength(0);});
it('rejects unsupported Traffic in Upgraded Smart+ without silently creating classic Traffic',async()=>{const r=await run('tiktok_create_smart_plus_campaign',{configuration:{...smartWeb,objective_type:'TRAFFIC'},currency:'USD',confirm:true});expect(r.error).toBeTruthy();expect(requests).toHaveLength(0);});
it('preserves a documented Smart+ request and never falls back to legacy after sandbox 404',async()=>{
 const args={configuration:smartWeb,currency:'USD',confirm:true};
 vi.mocked(fetch).mockImplementationOnce(async()=>new Response(JSON.stringify({code:0,data:{list:[{advertiser_id:'123',name:'Acme',currency:'USD'}]}}))).mockImplementationOnce(async()=>new Response('Not Found',{status:404}));
 const r=await run('tiktok_create_smart_plus_campaign',args);expect(r.outcome).toBe('not_applied');expect(r.error).toContain('404');
 const calls=vi.mocked(fetch).mock.calls;expect(calls).toHaveLength(2);expect(String(calls[1][0])).toContain('/smart_plus/campaign/create/');expect(JSON.parse(String(calls[1][1]?.body))).toMatchObject({request_id:smartWeb.request_id,sales_destination:'WEBSITE',operation_status:'DISABLE',budget_mode:'BUDGET_MODE_DYNAMIC_DAILY_BUDGET'});
});
it('updates only the requested Smart+ material and verifies its status',async()=>{
 const r=await run('tiktok_update_smart_plus_material_status',{smartPlusAdId:'500',materialIds:['600'],status:'DISABLE',confirm:true});
 expect(r).toMatchObject({applied:true,verification:{confirmed:true,checked:1,total:1,parentAdStatus:'DISABLE',materials:[{ad_material_id:'600',material_operation_status:'DISABLE'}]}});
 const writes=requests.filter(r=>r.method==='POST');expect(writes).toHaveLength(1);expect(writes[0].url.pathname).toBe('/open_api/v1.3/smart_plus/ad/material_status/update/');expect(writes[0].body).toEqual({advertiser_id:'123',smart_plus_ad_id:'500',ad_material_ids:['600'],operation_status:'DISABLE'});
});
it('rejects materials from a different Smart+ ad before writing',async()=>{
 const r=await run('tiktok_update_smart_plus_material_status',{smartPlusAdId:'500',materialIds:['999'],status:'DISABLE',confirm:true});
 expect(r.error).toContain('belong');expect(requests.every(r=>r.method==='GET')).toBe(true);
});
it.each([[],['600','600'],Array.from({length:21},(_,i)=>String(600+i)),['video-file']])('rejects invalid material selection %j without API calls',async materialIds=>{
 const r=await run('tiktok_update_smart_plus_material_status',{smartPlusAdId:'500',materialIds,status:'DISABLE',confirm:true});expect(r.error).toBeTruthy();expect(requests).toHaveLength(0);
});
it('does not claim a material status verified while readback is stale',async()=>{
 overrides['GET:/open_api/v1.3/smart_plus/ad/get/']={code:0,data:{list:[{advertiser_id:'123',smart_plus_ad_id:'500',operation_status:'DISABLE',creative_list:[{ad_material_id:'600',material_operation_status:'ENABLE'}]}]}};
 const r=await run('tiktok_update_smart_plus_material_status',{smartPlusAdId:'500',materialIds:['600'],status:'DISABLE',confirm:true});expect(r).toMatchObject({applied:true,verification:{confirmed:false}});expect(requests.filter(r=>r.method==='POST')).toHaveLength(1);
});
it('reads paused Smart+ parents with STATUS_ALL before an ad mutation',async()=>{
 const previous=fetch;vi.stubGlobal('fetch',vi.fn((input:any,init:any)=>{const url=new URL(String(input));if(url.pathname==='/open_api/v1.3/smart_plus/adgroup/get/'&&JSON.parse(url.searchParams.get('filtering')||'{}').primary_status!=='STATUS_ALL')return Promise.resolve(new Response(JSON.stringify({code:0,data:{list:[]}})));return previous(input,init);}));
 const args=cases.find(([n])=>n==='tiktok_create_smart_plus_ad')![1];expect(await run('tiktok_create_smart_plus_ad',{...args,confirm:true})).toMatchObject({applied:true});
});
it('replays the accepted Smart+ value/video payload shape through MCP handlers',async()=>{
 overrides['GET:/open_api/v1.3/advertiser/info/']={code:0,data:{list:[{advertiser_id:'123',currency:'EUR',timezone:'Etc/GMT-1'}]}};
 overrides['GET:/open_api/v1.3/smart_plus/campaign/get/']={code:0,data:{list:[{advertiser_id:'123',campaign_id:'200',operation_status:'DISABLE',budget:20,budget_optimize_on:true,budget_mode:'BUDGET_MODE_DYNAMIC_DAILY_BUDGET'}]}};
 const campaign={campaign_name:'FR_Value_TEST',objective_type:'WEB_CONVERSIONS',sales_destination:'WEBSITE',catalog_enabled:false,budget_optimize_on:true,budget_mode:'BUDGET_MODE_DYNAMIC_DAILY_BUDGET',budget:20,request_id:'1788813184506001'};
 const group={campaign_id:'200',adgroup_name:'FR_Value_Group_TEST',request_id:'1788813184506002',promotion_type:'WEBSITE',optimization_goal:'VALUE',optimization_event:'SHOPPING',pixel_id:'700',deep_bid_type:'VO_HIGHEST_VALUE',bid_type:'BID_TYPE_NO_BID',billing_event:'OCPM',schedule_type:'SCHEDULE_START_END',schedule_start_time:'2026-09-09T00:00:00+01:00',schedule_end_time:'2026-09-11T23:59:59+01:00',placement_type:'PLACEMENT_TYPE_NORMAL',placements:['PLACEMENT_TIKTOK'],targeting_optimization_mode:'MANUAL',targeting_spec:{location_ids:['3017382'],age_groups:['AGE_18_24','AGE_25_34','AGE_35_44','AGE_45_54','AGE_55_100'],gender:'GENDER_UNLIMITED',excluded_audience_ids:['701'],smart_audience_enabled:false,smart_interest_behavior_enabled:false},click_attribution_window:'SEVEN_DAYS',view_attribution_window:'ONE_DAY',attribution_event_count:'EVERY'};
 const ad={adgroup_id:'300',ad_name:'Exact business ad_TEST',creative_list:[{creative_info:{ad_format:'SINGLE_VIDEO',video_info:{video_id:'video-post-it'},image_info:[{web_uri:'cover-post-it'}],identity_type:'BC_AUTH_TT',identity_id:'identity-fixture',identity_authorized_bc_id:'702',aigc_disclosure_type:'SELF_DISCLOSURE'}}],ad_text_list:[{ad_text:'Autumn collection'}],landing_page_url_list:[{landing_page_url:'https://example.com/new'}],ad_configuration:{call_to_action_id:'703',dark_post_status:'ON',creative_auto_add_toggle:false,creative_auto_enhancement_strategy_list:[],product_info_enabled:'UNSET',utm_params:[{key:'utm_source',value:'tiktok'}]}};
 for(const [name,configuration] of [['tiktok_create_smart_plus_campaign',campaign],['tiktok_create_smart_plus_adgroup',group],['tiktok_create_smart_plus_ad',ad]] as const){expect(await run(name,{configuration,currency:'EUR',confirm:true})).toMatchObject({applied:true});}
 const writes=requests.filter(r=>r.method==='POST');expect(writes).toHaveLength(3);expect(writes.every(r=>r.body.operation_status==='DISABLE')).toBe(true);expect(writes[0].body.budget).toBe(20);expect(writes[1].body).toMatchObject({schedule_start_time:'2026-09-08 23:00:00',schedule_end_time:'2026-09-11 22:59:59',targeting_spec:{location_ids:['3017382']}});expect(writes[1].body.budget).toBeUndefined();expect(writes[2].body.creative_list).toEqual(ad.creative_list);expect(writes[2].body.ad_name).toBe(ad.ad_name);
});
