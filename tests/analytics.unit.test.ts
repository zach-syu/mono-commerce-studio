import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.resetModules();});
it('does not transmit product content or credentials with workflow events',async()=>{
 vi.stubEnv('VITE_POSTHOG_KEY','phc_test');vi.stubEnv('VITE_POSTHOG_HOST','https://us.i.posthog.com');vi.stubEnv('VITE_ANALYTICS_DISABLED','0');
 const fetcher=vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch',fetcher);
 const {track}=await import('../src/lib/analytics');
 await track('mono_copy_completed',{category:'food',language:'ja',provider:'gemini-api',prompt:'PRIVATE MERCHANT COPY',sourceDataUrl:'data:image/png;base64,PRIVATE',accessCode:'PRIVATE_SECRET',name:'PRIVATE PRODUCT'});
 expect(fetcher).toHaveBeenCalledTimes(1);
 const body=JSON.parse(fetcher.mock.calls[0][1].body);
 expect(body.properties.category).toBe('food');expect(body.properties.language).toBe('ja');
 expect(body.properties.$process_person_profile).toBe(false);expect(body.properties.$geoip_disable).toBe(true);
 expect(JSON.stringify(body)).not.toContain('PRIVATE');
 expect(fetcher.mock.calls[0][1].credentials).toBe('omit');
});
it('does not interrupt generation when analytics is unavailable',async()=>{
 vi.stubEnv('VITE_POSTHOG_KEY','phc_test');vi.stubEnv('VITE_ANALYTICS_DISABLED','0');vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
 const {track}=await import('../src/lib/analytics');await expect(track('mono_generation_completed',{outputCount:4})).resolves.toBeUndefined();
});
