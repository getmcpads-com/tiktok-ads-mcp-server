import { afterEach, expect, it, vi } from 'vitest';
import { parseTikTokJson } from '../../src/core/tiktok-json';
import { tiktokWriteApi } from '../../src/platforms/tiktok/write-api';

afterEach(() => vi.unstubAllGlobals());
const response = '{"code":0,"data":{"tracking_pixel_id":7216267239261995009,"ad_ref_pixel_id":7216267239261995009,"nested":[9223372036854775807],"budget":20,"rate":0.125,"scientific":1e3,"text":"pixel 7216267239261995009 \\"quoted\\""}}';

it('preserves unquoted 64-bit IDs without changing text, fractions or safe numeric metrics', () => {
  const result = parseTikTokJson(response);
  expect(result).toEqual({code:0,data:{tracking_pixel_id:'7216267239261995009',ad_ref_pixel_id:'7216267239261995009',nested:['9223372036854775807'],budget:20,rate:0.125,scientific:1000,text:'pixel 7216267239261995009 "quoted"'}});
  expect(() => parseTikTokJson('{"broken":}')).toThrow();
});

it('preserves exact IDs through the native write and verification transport', async () => {
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(response,{headers:{'content-type':'application/json'}})));
  const result = await tiktokWriteApi({accessToken:'fixture'}).call('ad/get/','GET',{advertiser_id:'123'});
  expect(result.data.tracking_pixel_id).toBe('7216267239261995009');
});
