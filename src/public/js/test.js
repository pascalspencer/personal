const WebSocket = require('ws');
const DerivAPI = require('@deriv/deriv-api/dist/DerivAPI');
const fs = require('fs');


// app_id 1089 is for testing, create your own app_id and use it here.
// go to api.deriv.com to register your own app.
const connection = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
const api        = new DerivAPI({ connection });
const basic = api.basic;


const contracts_for_symbol_request = {
    contracts_for: 'R_50',
    currency: 'USD',
    landing_company: 'svg',
    product_type: 'basic',
  };
  
  const contractsForSymbolResponse = async (res) => {
    const data = JSON.parse(res.data);
  
    if (data.error !== undefined) {
      console.log('Error : ', data.error?.message);
      connection.removeEventListener('message', contractsForSymbolResponse, false);
      await basic.disconnect();
    }
  
    if (data.msg_type === 'contracts_for') {
      const contractsData = data.contracts_for;
      // for (const contract of contractsData) {
      //   const contracType = contract.contract_type;
        console.log(contractsData);
      
    }
  
    connection.removeEventListener('message', contractsForSymbolResponse, false);
  };
  
  const getContractsForSymbol = async () => {
    connection.addEventListener('message', contractsForSymbolResponse);
    await basic.contractsFor(contracts_for_symbol_request);
  };
  
getContractsForSymbol()  