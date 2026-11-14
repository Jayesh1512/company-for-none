import { fingerprint } from '../contracts.mjs';
import { atomic, money, sameAsset, amount, emptyFinancial, balanceChange, protectedChange, assertConservation, requireFresh, integrity, conflict } from './state.mjs';
import { initializeObservationFacts, storeBalanceSnapshot, storeOpening, storeCashReceipt, storeCreditReceipt, postEconomicMovement } from './observations.mjs';

const clone = value => structuredClone(value);
const kindOf = plan => plan?.kind ?? plan?.type;
const idRequired = (value, name) => { if (typeof value !== 'string' || !value) integrity(`${name} required`); return value; };

/** Records exact approved M01 plans. It never selects amounts, recipients or retries. */
export function createTreasury({ journal, clock = () => new Date(), getPolicyState } = {}) {
  if (!journal) integrity('Journal required');
  const read = tx => (tx ?? journal).get('treasury', 'financial') ?? emptyFinancial();
  const currentPolicy = () => getPolicyState?.();
  const snapshot = () => {
    const state = initializeObservationFacts(read());
    const day = new Date(clock()).toISOString().slice(0, 10);
    state.dailyCosts[day] ??= '0';
    return state;
  };
  function write(tx, state) { assertConservation(state); state.version++; tx.put('treasury', 'financial', state); return clone(state); }
  function emit(tx, actionId, kind, data, index = 0) {
    return tx.append(kind, { id: `${actionId}:${kind}:${index}`, actionId, ...data });
  }
  const planIdentity = plan => kindOf(plan) === 'allocation' ? `settlement:${idRequired(plan.settlementId, 'settlementId')}` : kindOf(plan) === 'late_payment' ? `settlement:${idRequired(plan.receiptId, 'receiptId')}` : plan.receiptId ? `receipt:${plan.receiptId}` : null;
  function applyPayoutResult(tx, { actionId, result }) {
    const state = read(tx);
    const approved = state.approvedPlans.find(item => item.actionId === actionId && kindOf(item.plan) === 'payout');
    if (!approved) conflict('Approved frozen payout plan missing');
    const plan = approved.plan;
    const obligation = state.obligations.find(item => item.id === plan.obligationId);
    const progressId = `${actionId}:${fingerprint(result)}`;
    if (state.receipts.some(item => item.id === progressId)) return { financial: state, duplicate: true };
    if (obligation.status === 'paid') {
      if (result.status !== 'confirmed') conflict('Confirmed payout cannot regress');
      return { financial: state, duplicate: true };
    }
    if (result.status === 'confirmed') {
      if (state.receipts.some(item => item.id === `payout-confirmed:${actionId}`)) return { financial: state, duplicate: true };
      postEconomicMovement(state, { resource: 'cash', value: plan.money, metadata: result.receipt ?? {}, id: `payout-confirmed:${actionId}`, direction: 'out', sourceKind: 'payout' });
      protectedChange(state, `contributor:${obligation.id}`, plan.money, -1, 'contributor');
      balanceChange(state, plan.money, -1);
      obligation.completedAmount = typeof plan.completedAmount === 'string' ? plan.completedAmount : plan.completedAmount.amount;
      obligation.status = atomic(obligation.completedAmount) === atomic(obligation.money.amount) ? 'paid' : 'partially_paid';
      state.receipts.push({ id: `payout-confirmed:${actionId}` });
    } else obligation.status = result.status === 'not_submitted' ? 'due' : result.status;
    obligation.payoutResult = clone(result);
    state.receipts.push({ id: progressId });
    emit(tx, actionId, `payout.${result.status}`, { status: result.status, mode: result.mode, money: plan.money, obligationId: obligation.id, orderId: obligation.orderId, ...(result.evidenceRef ? { evidenceRef: result.evidenceRef } : {}) });
    return { financial: write(tx, state), duplicate: false };
  }
  const api = {
    snapshot,
    getObligation(id) { return clone(read().obligations.find(item => item.id === id) ?? null); },
    async applyDecision({ actionId, decision, expectedVersion } = {}) {
      idRequired(actionId, 'actionId');
      const plan = decision?.plan;
      if (!plan) integrity('Exact Rules plan required');
      const immutable = fingerprint({ actionFingerprint: decision.actionFingerprint, plan });
      return journal.transaction({ actionId: `treasury:plan:${actionId}`, fingerprint: immutable }, tx => {
        const state = read(tx);
        const identity = planIdentity(plan);
        const existing = identity && state.receipts.find(item => item.id === identity);
        if (existing) {
          if (existing.fingerprint !== fingerprint(plan)) conflict('Receipt reused with a different approved plan');
          return { financial: clone(state), duplicate: true };
        }
        requireFresh(state, decision, expectedVersion, currentPolicy());
        const kind = kindOf(plan);
        const common = { status: 'confirmed', mode: decision.mode ?? plan.mode ?? 'fixture', ...(plan.orderId ? { orderId: plan.orderId } : {}), ...(plan.evidenceRef ? { evidenceRef: plan.evidenceRef } : {}) };
        switch (kind) {
          case 'native_balance_snapshot': {
            state.nativeAccounts??=[];
            const observation=plan.observation;idRequired(observation?.accountId,'native account');atomic(observation.balanceYocto);
            if(!Number.isSafeInteger(observation.blockHeight)||observation.blockHeight<1)integrity('Final native block required');
            const old=state.nativeAccounts.find(x=>x.accountId===observation.accountId&&x.networkId===observation.networkId);
            if(old&&old.blockHeight>observation.blockHeight)conflict('Native snapshot cannot regress');
            if(old&&old.blockHeight===observation.blockHeight&&(old.balanceYocto!==observation.balanceYocto||old.blockHash!==observation.blockHash))conflict('Native snapshot conflicts at the same final block');
            if(old)Object.assign(old,clone(observation));else state.nativeAccounts.push(clone(observation));
            emit(tx,actionId,'native.balance_observed',{...common,evidenceRef:observation.reference});break;
          }
          case 'operational_cost': {
            const reservation=state.reservations.find(r=>r.id===plan.reservationId);
            if(!reservation||['released','reconciled'].includes(reservation.status))conflict('Original cost reservation required');
            const actual=atomic(plan.actualCostNanoUsd);idRequired(plan.receiptId,'cost receipt');idRequired(plan.evidenceRef,'cost evidence');
            if(actual>atomic(reservation.upperBoundNanoUsd))conflict('Cost exceeds reserved bound');
            if(state.receipts.some(r=>r.id===plan.receiptId))conflict('Cost receipt already used');
            if(plan.nativeFeeYocto!==undefined){const fee=atomic(plan.nativeFeeYocto);if(!reservation.nativeResource||fee>atomic(reservation.nativeResource.amountYocto)||!Number.isSafeInteger(plan.nativeSettledBlockHeight)||plan.nativeSettledBlockHeight<1)conflict('Native fee differs from original resource reservation');reservation.actualNativeFeeYocto=plan.nativeFeeYocto;reservation.nativeSettledBlockHeight=plan.nativeSettledBlockHeight;}
            reservation.status='reconciled';reservation.actualCostNanoUsd=actual.toString();
            state.dailyCosts[plan.accountingDay]=(atomic(state.dailyCosts[plan.accountingDay]??'0')+actual).toString();
            state.receipts.push({id:plan.receiptId,actionId,fingerprint:fingerprint(plan)});
            emit(tx,actionId,'operational_cost.recorded',{...common,costNanoUsd:actual.toString(),reservationId:reservation.id,expenseCategory:plan.expenseCategory,evidenceRef:plan.evidenceRef});break;
          }
          case 'balance_snapshot': {
            const safeFact = storeBalanceSnapshot(state, plan);
            // Absolute provider amounts/bindings stay private. Disclosure requires M01.
            emit(tx, actionId, 'balance.observed', { ...common, ...safeFact });
            break;
          }
          case 'cash_opening': case 'credit_opening': {
            const resource = kind === 'cash_opening' ? 'cash' : 'credit';
            const safeFact = storeOpening(state, resource, plan);
            emit(tx, actionId, `${resource}.opened`, { ...common, ...safeFact, provenance: plan.provenance,
              ...(resource === 'cash' ? { money: plan.money } : { creditNanoUsd: plan.credit.availableNanoUsd }) });
            break;
          }
          case 'cash_receipt': {
            const posted = storeCashReceipt(state, plan);
            emit(tx, actionId, 'cash.received', { ...common, money: plan.money, scopeId: posted.scopeId, provenance: plan.provenance, evidenceRef: plan.evidenceRef });
            break;
          }
          case 'credit_receipt': {
            const posted = storeCreditReceipt(state, plan);
            emit(tx, actionId, 'credit.received', { ...common, creditNanoUsd: plan.credit.availableNanoUsd, scopeId: posted.scopeId, provenance: plan.provenance, evidenceRef: plan.evidenceRef });
            break;
          }
          case 'capital': {
            if (decision.mode !== 'fixture' || (state.openingRecords ?? []).length) conflict('Legacy fixture capital cannot import provider balances into an opened economic store');
            money(plan.money);balanceChange(state,plan.money,1);
            emit(tx,actionId,'capital.recorded',{...common,money:plan.money,provenance:plan.provenance,evidenceRef:plan.reference});break;
          }
          case 'credit_observation': {
            if (decision.mode !== 'fixture' || (state.openingRecords ?? []).length) conflict('Legacy fixture credit import cannot post provider balance snapshots');
            const credit=plan.credit;atomic(credit.availableNanoUsd);idRequired(credit.id,'credit.id');
            if(state.credits.lots.some(c=>c.id===credit.id||c.reference===credit.reference))conflict('Credit observation already recorded');
            state.credits.lots.push(clone(credit));state.credits.availableNanoUsd=(atomic(state.credits.availableNanoUsd)+atomic(credit.availableNanoUsd)).toString();
            emit(tx,actionId,'credit.observed',{...common,creditNanoUsd:credit.availableNanoUsd,provenance:credit.provenance,evidenceRef:credit.reference});break;
          }
          case 'procurement_record': {
            const reservation=state.reservations.find(r=>r.id===plan.reservationId);
            if(!reservation||reservation.status==='reconciled')conflict('Purchase reservation missing or reconciled');
            if(fingerprint(reservation.resource)!==fingerprint(plan.money))conflict('Purchase receipt differs from reserved money');
            postEconomicMovement(state, { resource: 'cash', value: plan.money, metadata: plan, id: plan.receiptId, direction: 'out', sourceKind: 'procurement_record' });
            balanceChange(state,plan.money,-1);reservation.status='reconciled';
            emit(tx,actionId,'procurement.confirmed',{...common,money:plan.money,reservationId:plan.reservationId,expenseCategory:'skill_licence'});break;
          }
          case 'bootstrap': {
            if (state.version !== 0 || state.balances.length || state.credits.lots.length) conflict('Bootstrap requires an empty financial store');
            money(plan.money);
            idRequired(plan.receiptId, 'bootstrap receiptId');
            idRequired(plan.provenance, 'bootstrap provenance');
            balanceChange(state, plan.money, 1);
            emit(tx, actionId, 'fixture.bootstrap', { ...common, money: plan.money, provenance: plan.provenance });
            break;
          }
          case 'allocation': {
            money(plan.revenue); money(plan.treasury); money(plan.contributorReserve); money(plan.refundReserve);
            for (const field of ['treasury', 'contributorReserve', 'refundReserve']) if (!sameAsset(plan.revenue, plan[field])) integrity('Allocation units differ');
            if (!Array.isArray(plan.obligations)) integrity('Exact obligations required');
            let owed = 0n;
            const recipients = new Set();
            for (const obligation of plan.obligations) {
              idRequired(obligation.id, 'obligation.id'); idRequired(obligation.recipient, 'obligation.recipient'); money(obligation.money);
              if (!sameAsset(plan.revenue, obligation.money) || atomic(obligation.completedAmount) !== 0n) integrity('New obligation must be uncompleted in settlement units');
              if (state.obligations.some(item => item.id === obligation.id || (item.settlementId === plan.settlementId && item.recipient === obligation.recipient)) || recipients.has(obligation.recipient)) conflict('Obligation identity already exists');
              recipients.add(obligation.recipient); owed += atomic(obligation.money.amount);
            }
            if (owed !== atomic(plan.contributorReserve.amount) || owed + atomic(plan.treasury.amount) !== atomic(plan.revenue.amount)) integrity('Approved allocation amounts do not conserve settlement');
            postEconomicMovement(state, { resource: 'cash', value: plan.revenue, metadata: plan, id: plan.settlementId, direction: 'in', sourceKind: 'allocation' });
            balanceChange(state, plan.revenue, 1);
            state.allocations.push(clone({ ...plan, actionId }));
            for (const [index, obligation] of plan.obligations.entries()) {
              const frozen = clone({ ...obligation, settlementId: plan.settlementId, orderId: plan.orderId });
              state.obligations.push(frozen);
              protectedChange(state, `contributor:${obligation.id}`, obligation.money, 1, 'contributor', { obligationId: obligation.id, orderId: plan.orderId });
              emit(tx, actionId, 'obligation.due', { ...common, status: 'due', obligationId: obligation.id, money: obligation.money }, index);
            }
            protectedChange(state, `refund:${plan.orderId}`, plan.refundReserve, 1, 'refund', { orderId: plan.orderId });
            emit(tx, actionId, 'sale.confirmed', { ...common, money: plan.revenue });
            break;
          }
          case 'late_payment': {
            idRequired(plan.orderId, 'late payment orderId'); money(plan.revenue); money(plan.refundReserve); money(plan.refundExposure);
            if (!sameAsset(plan.revenue, plan.refundReserve) || !sameAsset(plan.revenue, plan.refundExposure) || plan.revenue.amount !== plan.refundReserve.amount) integrity('Exact late receipt and funded refund reserve do not reconcile');
            postEconomicMovement(state, { resource: 'cash', value: plan.revenue, metadata: plan, id: plan.receiptId, direction: 'in', sourceKind: 'late_payment' });
            balanceChange(state, plan.revenue, 1);
            protectedChange(state, `refund:${plan.orderId}`, plan.refundReserve, 1, 'refund', { orderId: plan.orderId });
            state.latePayments ??= [];
            state.latePayments.push(clone({ ...plan, actionId, status: 'awaiting_refund' }));
            emit(tx, actionId, 'payment.late', { ...common, status: 'awaiting_refund', money: plan.revenue });
            break;
          }
          case 'procurement':
          case 'reservation': {
            const reservation = plan.reservation;
            idRequired(reservation?.id, 'reservation.id'); idRequired(reservation.actionId, 'reservation.actionId');
            idRequired(reservation.accountingDay, 'accountingDay'); atomic(reservation.upperBoundNanoUsd, 'upperBoundNanoUsd');
            if (state.reservations.some(item => item.id === reservation.id || item.actionId === reservation.actionId)) conflict('Reservation already exists');
            if (reservation.resource) money(reservation.resource);
            state.reservations.push(clone(reservation));
            if(reservation.nativeResource){
              const n=reservation.nativeResource,observed=state.nativeAccounts?.find(a=>a.accountId===n.accountId&&a.networkId===n.networkId);
              if(!observed)conflict('Original native account snapshot required');
              const locked=state.reservations.filter(r=>r.nativeResource?.accountId===n.accountId&&r.nativeResource.networkId===n.networkId&&r.status!=='released').reduce((s,r)=>s+(['reconciled','failed'].includes(r.status)?!Number.isSafeInteger(r.nativeSettledBlockHeight)||r.nativeSettledBlockHeight>observed.blockHeight?atomic(r.actualNativeFeeYocto??r.nativeResource.amountYocto):0n:atomic(r.nativeResource.amountYocto)),0n);
              if(locked>atomic(observed.balanceYocto))conflict('Native fee reservation exceeds observed resource');
            }
            if (reservation.resource && atomic(reservation.resource.amount) > 0n && !state.balances.some(balance => sameAsset(balance, reservation.resource))) conflict('Reservation has no recorded controlled cash');
            // A lock cannot name cash already assigned to another reserve. This is storage integrity.
            for (const balance of state.balances) {
              const held = state.protectedFunds.filter(x => sameAsset(x, balance)).reduce((sum, x) => sum + atomic(x.amount), 0n);
              const locked = state.reservations.filter(x => x.resource && sameAsset(x.resource, balance) && !['released', 'reconciled', 'failed'].includes(x.status)).reduce((sum, x) => sum + atomic(x.resource.amount), 0n);
              if (held + locked > atomic(balance.amount)) conflict('Reservation overlaps protected or previously locked cash');
            }
            emit(tx, actionId, 'reservation.recorded', { ...common, status: reservation.status, reservationId: reservation.id, upperBoundNanoUsd: reservation.upperBoundNanoUsd, accountingDay: reservation.accountingDay, purpose: reservation.purpose });
            break;
          }
          case 'funding': {
            money(plan.cashSpent); idRequired(plan.receiptId, 'receiptId');
            const credit = plan.credit;
            idRequired(credit?.id, 'credit.id'); idRequired(credit.owner, 'credit.owner'); idRequired(credit.provider, 'credit.provider'); idRequired(credit.provenance, 'credit.provenance'); atomic(credit.availableNanoUsd);
            if (state.credits.lots.some(item => item.id === credit.id)) conflict('Credit receipt already exists');
            postEconomicMovement(state, { resource: 'cash', value: plan.cashSpent, metadata: plan.cashMovement ?? plan, id: `cash:${plan.receiptId}`, direction: 'out', sourceKind: 'funding' });
            const creditMovement = postEconomicMovement(state, { resource: 'credit', value: credit.availableNanoUsd, metadata: plan.creditMovement ?? credit, id: `credit:${plan.receiptId}`, direction: 'in', sourceKind: 'funding' });
            balanceChange(state, plan.cashSpent, -1);
            state.credits.lots.push({ ...clone(credit), ...(creditMovement ? { binding: creditMovement.binding, scopeId: creditMovement.scopeId, recordType: 'receipt' } : {}) });
            state.credits.availableNanoUsd = (atomic(state.credits.availableNanoUsd) + atomic(credit.availableNanoUsd)).toString();
            if (plan.reservationId) {
              const reservation = state.reservations.find(x => x.id === plan.reservationId);
              if (!reservation) conflict('Funding reservation missing');
              reservation.status = 'reconciled';
            }
            emit(tx, actionId, 'funding.confirmed', { ...common, money: plan.cashSpent, creditNanoUsd: credit.availableNanoUsd, expenseCategory: 'cash_to_credit', provenance: credit.provenance, ...(plan.reservationId ? { reservationId: plan.reservationId } : {}) });
            break;
          }
          case 'consumption': {
            idRequired(plan.receiptId, 'receiptId'); idRequired(plan.accountingDay, 'accountingDay');
            const actual = atomic(plan.actualCostNanoUsd, 'actualCostNanoUsd');
            const reservation = state.reservations.find(item => item.id === plan.reservationId);
            const credit = state.credits.lots.find(item => item.id === plan.creditId);
            if (!reservation || !credit) conflict('Consumption reservation or owned credit missing');
            const remaining = atomic(plan.remainingCreditNanoUsd);
            if (atomic(credit.availableNanoUsd) !== remaining + actual) integrity('Consumption does not reconcile exact owned credit');
            if (['reconciled', 'released'].includes(reservation.status)) conflict('Reservation already reconciled');
            if (plan.binding && credit.binding && fingerprint(plan.binding) !== fingerprint(credit.binding)) conflict('Consumption binding differs from the owned credit lot');
            postEconomicMovement(state, { resource: 'credit', value: plan.actualCostNanoUsd, metadata: { ...plan, ...(!plan.binding && credit.binding ? { binding: credit.binding } : {}) }, id: plan.receiptId, direction: 'out', sourceKind: 'consumption' });
            credit.availableNanoUsd = plan.remainingCreditNanoUsd;
            state.credits.availableNanoUsd = (atomic(state.credits.availableNanoUsd) - actual).toString();
            state.dailyCosts[plan.accountingDay] = (atomic(state.dailyCosts[plan.accountingDay] ?? '0') + actual).toString();
            reservation.status = 'reconciled'; reservation.actualCostNanoUsd = plan.actualCostNanoUsd;
            emit(tx, actionId, 'inference.consumed', { ...common, costNanoUsd: plan.actualCostNanoUsd, expenseCategory: 'inference', reservationId: reservation.id, accountingDay: plan.accountingDay });
            break;
          }
          case 'payout': {
            const obligation = state.obligations.find(item => item.id === plan.obligationId);
            if (!obligation) conflict('Obligation missing');
            money(plan.money);
            if (obligation.recipient !== plan.recipient || !sameAsset(obligation.money, plan.money)) conflict('Frozen obligation changed');
            const completed = typeof plan.completedAmount === 'string' ? plan.completedAmount : money(plan.completedAmount).amount;
            if (atomic(completed) !== atomic(obligation.completedAmount) + atomic(plan.money.amount) || atomic(completed) > atomic(obligation.money.amount)) integrity('Exact payout progress does not reconcile obligation');
            const reserve = state.protectedFunds.find(item => item.id === `contributor:${obligation.id}`);
            if (!reserve || !sameAsset(reserve, plan.money) || atomic(reserve.amount) < atomic(plan.money.amount)) conflict('Payout does not have its recorded contributor reserve');
            if (obligation.payoutActionId && obligation.payoutActionId !== actionId && !(obligation.status === 'partially_paid' && obligation.payoutResult?.status === 'confirmed')) conflict('Obligation already has a payout operation; reconcile it');
            obligation.payoutActionId = actionId;
            break;
          }
          case 'refund_intent': {
            idRequired(plan.orderId, 'refund orderId'); idRequired(plan.recipient, 'refund recipient'); money(plan.money);
            const reserve = state.protectedFunds.find(item => item.orderId === plan.orderId && item.purpose === 'refund' && sameAsset(item, plan.money));
            if (!reserve || atomic(reserve.amount) < atomic(plan.money.amount)) conflict('Refund does not have its recorded funded reserve');
            state.refunds ??= [];
            if (state.refunds.some(item => item.orderId === plan.orderId)) conflict('Refund already has an operation; reconcile it');
            state.refunds.push({ actionId, orderId: plan.orderId, recipient: plan.recipient, money: clone(plan.money), status: 'not_submitted' });
            break;
          }
          case 'refund': {
            idRequired(plan.receiptId, 'refund receiptId'); idRequired(plan.orderId, 'refund orderId'); money(plan.money);
            if (plan.status !== 'confirmed' || !Array.isArray(plan.releaseProtected) || !Array.isArray(plan.obligations)) integrity('Exact confirmed refund reversal plan required');
            state.refunds ??= [];
            const existingRefund = state.refunds.find(item => item.orderId === plan.orderId);
            if (existingRefund?.status === 'confirmed') conflict('Order already refunded');
            for (const release of plan.releaseProtected) {
              const resource = state.protectedFunds.find(item => item.id === release.id && item.orderId === plan.orderId);
              if (!resource) conflict('Refund reserve missing');
              protectedChange(state, resource.id, release.money, -1, resource.purpose);
            }
            postEconomicMovement(state, { resource: 'cash', value: plan.money, metadata: plan, id: plan.receiptId, direction: 'out', sourceKind: 'refund' });
            balanceChange(state, plan.money, -1);
            for (const progress of plan.obligations) {
              const obligation = state.obligations.find(item => item.id === progress.id && item.orderId === plan.orderId);
              if (!obligation || progress.completedAmount !== obligation.completedAmount) conflict('Refund cannot erase completed contributor payments');
              if (!['reversed', 'paid_before_refund'].includes(progress.status)) integrity('Exact refund obligation status required');
              if (progress.remainingDue) money(progress.remainingDue);
              Object.assign(obligation, clone(progress));
            }
            for (const allocation of state.allocations.filter(item => item.orderId === plan.orderId)) {
              allocation.status = 'refunded'; allocation.refundReceiptId = plan.receiptId;
              if (plan.refundExposure) allocation.refundExposure = clone(plan.refundExposure);
            }
            for (const payment of (state.latePayments ?? []).filter(item => item.orderId === plan.orderId)) {
              payment.status = 'refunded'; payment.refundReceiptId = plan.receiptId;
              if (plan.refundExposure) payment.refundExposure = clone(plan.refundExposure);
            }
            const progress = { actionId, orderId: plan.orderId, recipient: plan.recipient, money: clone(plan.money), receiptId: plan.receiptId, status: 'confirmed' };
            if (existingRefund) Object.assign(existingRefund, progress); else state.refunds.push(progress);
            emit(tx, actionId, 'refund.confirmed', { ...common, money: plan.money });
            break;
          }
          case 'reconciliation': {
            const reservation = state.reservations.find(item => item.id === plan.reservationId);
            if (!reservation) conflict('Reservation missing');
            if (!['reserved', 'pending', 'unknown', 'reconciled', 'released', 'failed'].includes(plan.status)) integrity('Invalid reservation status');
            if (['released', 'reconciled', 'failed'].includes(plan.status) && !plan.evidenceRef) integrity('Resolution evidence required');
            reservation.status = plan.status;
            if (plan.actualCostNanoUsd !== undefined) reservation.actualCostNanoUsd = atomic(plan.actualCostNanoUsd).toString();
            emit(tx, actionId, 'reservation.updated', { ...common, status: plan.status, reservationId: reservation.id, upperBoundNanoUsd: reservation.upperBoundNanoUsd, accountingDay: reservation.accountingDay, purpose: reservation.purpose });
            break;
          }
          default: integrity(`Unsupported exact financial plan: ${kind}`);
        }
        if (identity) state.receipts.push({ id: identity, fingerprint: fingerprint(plan), actionId });
        state.approvedPlans.push({ authorizationId:decision.authorizationId??null, actionId, fingerprint: decision.actionFingerprint, actionFingerprint: decision.actionFingerprint, plan: clone(plan), policyEpoch: decision.policyEpoch, inputVersion: state.version, appliedVersion: state.version + 1 });
        return { financial: write(tx, state), duplicate: false };
      });
    },
    async consumePermit({ actionId, permit, decision, expectedVersion } = {}) {
      idRequired(actionId, 'actionId'); idRequired(permit?.id, 'permit.id');
      return journal.transaction({ actionId: `treasury:permit:${permit.id}`, fingerprint: fingerprint({ actionId, permit }) }, tx => {
        const state = read(tx);
        const approved = state.approvedPlans.find(item => item.actionId === actionId && item.fingerprint === decision?.actionFingerprint && item.inputVersion === permit.financialVersion && item.appliedVersion === state.version && fingerprint(item.plan) === fingerprint(decision.plan));
        if (!approved) conflict('Exact approved plan changed before permit consumption');
        requireFresh(state, decision, expectedVersion, currentPolicy());
        if (permit.actionId !== actionId || permit.actionFingerprint !== decision.actionFingerprint || permit.policyEpoch !== decision.policyEpoch) conflict('Permit binding changed');
        if (permit.financialVersion !== approved.inputVersion) conflict('Permit financial version differs from approved plan');
        if (state.consumedPermits.some(item => item.id === permit.id)) conflict('Permit already consumed');
        state.consumedPermits.push({ ...clone(permit), permit: clone(permit), authorizedFinancialVersion: permit.financialVersion, previousFinancialVersion: state.version, consumedAt: new Date(clock()).toISOString(), financialVersion: state.version + 1 });
        return { financial: write(tx, state), consumed: true };
      });
    },
    async recordPayoutResult({ actionId, result } = {}) {
      idRequired(actionId, 'actionId');
      if (!['not_submitted', 'pending', 'confirmed', 'failed', 'unknown'].includes(result?.status)) integrity('Payout result status required');
      return journal.transaction({ actionId: `treasury:payout-result:${actionId}:${fingerprint(result)}`, fingerprint: fingerprint(result) }, tx => applyPayoutResult(tx, { actionId, result }));
    },
    // M09 combines its operation evidence and M03 bookkeeping in one M02 commit.
    applyPayoutResult,
  };
  return api;
}
