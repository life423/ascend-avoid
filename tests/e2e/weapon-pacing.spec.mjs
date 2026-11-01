import { test, expect } from '@playwright/test';

test.skip(process.env.E2E_TEST_HOOKS !== '1','isolated component-release clock');
test('normal component availability stays staggered in the synced room',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{localStorage.setItem('ascend.guideSeen','true');localStorage.setItem('ascend.mouseFollow','off');});
  await page.route('**/matchmake/joinOrCreate/game_room',route=>route.continue({
    url:route.request().url().replace('/joinOrCreate/','/create/'),
    postData:JSON.stringify({...route.request().postDataJSON(),testBots:0,testFieldGems:0,testWeaponSets:9,testWeapons:true,testCores:0,testCalm:true}),
  }));
  await page.goto('/');
  await page.waitForFunction(()=>window.game?.currentGameMode?.multiplayerManager?.room?.state?.players?.size);
  const read=()=>page.evaluate(()=>{
    const s=window.game.currentGameMode.multiplayerManager.room.state;
    const builds=[s.pinwheel,...s.weaponSets];
    return{time:s.time,parts:builds.filter(w=>w.phase==='parts').length,deadlines:builds.map(w=>w.at)};
  });
  const initial=await read();expect(initial.deadlines).toEqual([5000,17000,29000,41000,53000,65000,77000,89000,101000]);
  await expect.poll(async()=>(await read()).parts,{timeout:7000,intervals:[100]}).toBe(1);
  await page.waitForTimeout(6000);expect((await read()).parts).toBe(1);
  await expect.poll(async()=>(await read()).parts,{timeout:12000,intervals:[100]}).toBe(2);
  expect((await read()).time).toBeGreaterThanOrEqual(17000);expect(errors).toEqual([]);
});
