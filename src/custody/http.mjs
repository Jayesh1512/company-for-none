// Documented OutLayer custody endpoints only. No registration, policy mutation,
// raw signing or local private-key fallback is exposed by this client.
export function createOutLayerClient({ transport = fetch, resolveSecret, secretRef, network = 'near:mainnet' } = {}) {
  const base = network === 'near:testnet' ? 'https://testnet-api.outlayer.ai' : 'https://api.outlayer.ai';
  if (!['near:mainnet', 'near:testnet'].includes(network)) throw new TypeError('Unsupported NEAR network');
  async function prepare(path, body) {
    const key = await resolveSecret?.(secretRef);
    if (typeof key !== 'string' || !key) throw new Error('CREDENTIAL_UNAVAILABLE');
    return () => transport(base + path, {
      method: body ? 'POST' : 'GET', redirect: 'error',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000),
    }).then(response => {
      if (!response.ok) throw new Error('PROVIDER_HTTP_ERROR');
      return response.json();
    });
  }
  const request = async (path, body) => (await prepare(path, body))();
  return {
    address: () => request('/wallet/v1/address?chain=near'),
    balance: token => request('/wallet/v1/balance?chain=near' + (token ? `&token=${encodeURIComponent(token)}` : '')),
    transfer: action => request('/wallet/v1/transfer', { to: action.recipient, amount: action.money.amount }),
    prepareTransfer: action => prepare('/wallet/v1/transfer', { to: action.recipient, amount: action.money.amount }),
    prepareCall: action => prepare('/wallet/v1/call', {
      receiver_id: action.recipient, method_name: action.methodName, args: action.args, deposit: action.money.amount,
    }),
    call: action => request('/wallet/v1/call', {
      receiver_id: action.recipient, method_name: action.methodName,
      args: action.args, deposit: action.money.amount,
    }),
    status: id => request(`/wallet/v1/requests/${encodeURIComponent(id)}`),
  };
}
