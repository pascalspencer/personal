async function buyContract(symbol, tradeType, duration, price, prediction = null) {
  if (!api || api.is_closed) {
    console.error("❌ API not connected.");
    return;
  }

  console.log(`🚀 Preparing trade for ${symbol} (${tradeType})...`);
  //------------------------------------------
  const proposal = {
    proposal: 1,
    amount: price,
    basis: "stake",
    contract_type: tradeType,
    currency: "USD",
    symbol: symbol,
    duration: duration,
    duration_unit: "t"
  };

  // ---- VANILLA CONTRACTS (Rise/Fall, Touch/No Touch) ----
  if (["CALL", "PUT", "ONETOUCH", "NOTOUCH"].includes(tradeType)) {
    proposal.contract_type = tradeType;
  }

  // ---- DIGIT CONTRACTS ----
  else if (tradeType.startsWith("DIGIT")) {
    proposal.contract_type = tradeType;

    // These contracts REQUIRE prediction
    if (["DIGITMATCH", "DIGITDIFF", "DIGITOVER", "DIGITUNDER"].includes(tradeType)) {
      if (prediction === null || isNaN(prediction)) {
        console.warn("⚠️ Digit contract requires prediction (0-9). Defaulting to 0.");
        proposal.prediction = tradeDigit || 0;
      } else {
        proposal.prediction = Number(prediction);
      }
    }

    // EVEN / ODD → no prediction required
  }

  // ---- MULTIPLIER CONTRACTS ----
  else if (["MULTUP", "MULTDOWN"].includes(tradeType)) {
    proposal.contract_type = tradeType;
    
    // Deriv requires multiplier field
    proposal.multiplier = 10; // default – can be updated to user selection
  }

  // ---- UNKNOWN CONTRACT FALLBACK ----
  else {
    console.warn(`⚠️ Unknown contract type: ${tradeType}`);
    proposal.contract_type = tradeType;
  }

  //------------------------------------------
  // 6. REQUEST PROPOSAL
  //------------------------------------------
  let proposalResp;
  try {
    proposalResp = await api.proposal(proposal);
    console.log("Proposal response:", proposalResp);
  } catch (err) {
    console.error("❌ Proposal request failed:", err);
    return;
  }

  if (!proposalResp || proposalResp.error) {
    console.error("❌ Proposal error:", proposalResp.error);
    return;
  }

  const propId = proposalResp.proposal.id;
  console.log("🆔 Proposal ID:", propId);


  //------------------------------------------
  // 7. BUY CONTRACT
  //------------------------------------------
  let buyResp;
  try {
    buyResp = await api.buy({ buy: propId, price });
    console.log("Buy response:", buyResp);
  } catch (err) {
    console.error("❌ Buy call failed:", err);
    return;
  }

  if (buyResp.error) {
    console.error("❌ Buy error:", buyResp.error);
    return;
  }

  console.log("🎉 Contract bought successfully:", buyResp);
  return buyResp;
}
