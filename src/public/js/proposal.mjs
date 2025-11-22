const proposalCache = {}; // { symbol_tradeType: proposalResponse }


export async function prepareProposal(symbol, tradeType, duration = 1, price = 1) {

  if (!api || api.is_closed) {
    console.error("❌ API not connected.");
    return null;
  }

  const key = `${symbol}_${tradeType}`;
  if (proposalCache[key]) {
    console.log("✅ Using cached proposal for:", key);
    return proposalCache[key];
  }

  const proposal = {
    proposal: 1,
    amount: price,
    basis: "stake",
    contract_type: tradeType,
    currency: "USD",
    symbol,
    duration,
    duration_unit: "t"
  };

  try {
    const proposalResp = await api.proposal(proposal);
    if (!proposalResp || proposalResp.error) {
      console.error("❌ Proposal error:", proposalResp?.error);
      return null;
    }
    proposalCache[key] = proposalResp.proposal; // store proposal
    console.log("🆔 Proposal prepared for:", key);
    return proposalResp.proposal;
  } catch (err) {
    console.error("❌ Proposal request failed:", err);
    return null;
  }
}
