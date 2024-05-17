const DerivAPIBasic = require('@deriv/deriv-api/dist/DerivAPIBasic');
const WebSocket = require('ws');


const app_id = 1089; // Replace with your app_id or leave the current one for testing.
const connection = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${app_id}`);
const api = new DerivAPIBasic({ connection });

// Currently gets all available symbols.
const active_symbols_request = {
  // landing_company: "maltainvest", // Uncomment landing_company if you want to retrieve specific symbols.
  active_symbols: 'brief',
  product_type: 'basic',
};

const activeSymbolsResponse = async (res) => {
  const data = JSON.parse(res.data);

  if (data.error !== undefined) {
    console.log('Error : ', data.error?.message);
    connection.removeEventListener('message', activeSymbolsResponse, false);
    await api.disconnect();
  }

  if (data.msg_type === 'active_symbols') {
    console.log(data.active_symbols);
  }

  connection.removeEventListener('message', activeSymbolsResponse, false);
};

const getActiveSymbols = async () => {
  connection.addEventListener('message', activeSymbolsResponse);
  await api.activeSymbols(active_symbols_request);
};




// get ticks

const tickStream = () => api.subscribe({ ticks: 'R_100' });

const tickResponse = async (res) => {
  const data = JSON.parse(res.data);
  if (data.error !== undefined) {
    console.log('Error : ', data.error.message);
    connection.removeEventListener('message', tickResponse, false);
    await api.disconnect();
  }
  if (data.msg_type === 'tick') {
    console.log(data.tick);
  }
};

const subscribeTicks = async () => {
  await tickStream();
  connection.addEventListener('message', tickResponse);
};

const unsubscribeTicks = () => {
  connection.removeEventListener('message', tickResponse, false);
  tickStream().unsubscribe();
};


//ticks history

const ticks_history_request = {
    ticks_history: 'R_50',
    adjust_start_time: 1,
    count: 10,
    end: 'latest',
    start: 1,
    style: 'ticks',
  };
  
  const ticks_request = {
    ...ticks_history_request,
    subscribe: 1,
  };
  
  const tickSubscriber = () => api.subscribe(ticks_request);
  
  const ticksHistoryResponse = async (res) => {
    const data = JSON.parse(res.data);
    if (data.error !== undefined) {
      console.log('Error : ', data.error.message);
      connection.removeEventListener('message', ticksHistoryResponse, false);
      await api.disconnect();
    }
    if (data.msg_type === 'history') {
      console.log(data.history);
    }
    connection.removeEventListener('message', ticksHistoryResponse, false);
  };
  
  const ticksResponse = async (res) => {
    const data = JSON.parse(res.data);
    // This example returns an object with a selected amount of past ticks.
    if (data.error !== undefined) {
      console.log('Error : ', data.error.message);
      connection.removeEventListener('message', ticksResponse, false);
      await api.disconnect();
    }
    // Allows you to monitor ticks.
    if (data.msg_type === 'tick') {
      console.log(data.tick);
    }
  };
  
  const subscribeTick = async () => {
    connection.addEventListener('message', ticksResponse);
    await tickSubscriber();
  };
  
  const unsubscribeTick = async () => {
    connection.removeEventListener('message', ticksResponse, false);
    await tickSubscriber().unsubscribe();
  };
  
  const getTicksHistory = async () => {
    connection.addEventListener('message', ticksHistoryResponse);
    await api.ticksHistory(ticks_history_request);
  };
  
  const subscribe_ticks_button = document.querySelector('#ticks');
  subscribe_ticks_button.addEventListener('click', subscribeTick);
  
  const unsubscribe_ticks_button = document.querySelector('#ticks-unsubscribe');
  unsubscribe_ticks_button.addEventListener('click', unsubscribeTick);
  
  const ticks_history_button = document.querySelector('#ticks-history');
  ticks_history_button.addEventListener('click', getTicksHistory);
  

  //contract for symbols

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
      await api.disconnect();
    }
  
    if (data.msg_type === 'contracts_for') {
      console.log(data.contracts_for);
    }
  
    connection.removeEventListener('message', contractsForSymbolResponse, false);
  };
  
  const getContractsForSymbol = async () => {
    connection.addEventListener('message', contractsForSymbolResponse);
    await api.contractsFor(contracts_for_symbol_request);
  };
  
  const symbol_button = document.querySelector('#contractsForSymbol');
  symbol_button.addEventListener('click', getContractsForSymbol);

  

  
  //keep website awake

  const proposal = () => {
    api.subscribe({
      proposal: 1,
      subscribe: 1,
      amount: 10,
      basis: 'payout',
      contract_type: 'CALL',
      currency: 'USD',
      duration: 1,
      duration_unit: 'm',
      symbol: 'R_100',
      barrier: '+0.1',
    });
  };
  
  // Send a ping every 30 seconds to keep the connection alive
  // Needs to use the same websocket connection as the one you want to maintain.
  const ping = () => {
    setInterval(() => {
      api.ping();
    }, 30000);
  };
  
  const wsResponse = async (res) => {
    const data = JSON.parse(res.data);
    if (data.error !== undefined) {
      console.log('Error: %s ', data.error.message);
      connection.removeEventListener('message', wsResponse, false);
      await api.disconnect();
    } else if (data.msg_type === 'proposal') {
      console.log('Details: %s', data.proposal.longcode);
      console.log('Ask Price: %s', data.proposal.display_value);
      console.log('Payout: %f', data.proposal.payout);
      console.log('Spot: %f', data.proposal.spot);
    } else if (data.msg_type === 'ping') {
      console.log('ping');
    }
  };
  
  const checkSignal = () => {
    proposal();
    ping();
    connection.addEventListener('message', wsResponse);
  };
  
  const endCall = () => {
    connection.removeEventListener('message', wsResponse, false);
    proposal().unsubscribe();
  };
  
  const keep_alive_button = document.querySelector('#keep_alive');
  keep_alive_button.addEventListener('click', checkSignal);
  
  const end_call_button = document.querySelector('#end_call');
  end_call_button.addEventListener('click', endCall);
  