import { writeFileSync } from 'node:fs';

const originalFetch=globalThis.fetch;
globalThis.fetch=(input,options) => {
  if(String(input)==='https://api.resend.com/emails') {
    writeFileSync(process.env.V79_TEST_MAIL_OUT, options.body);
    return Promise.resolve(new Response(JSON.stringify({id:'test-message'}),{status:200,headers:{'content-type':'application/json'}}));
  }
  return originalFetch(input,options);
};
