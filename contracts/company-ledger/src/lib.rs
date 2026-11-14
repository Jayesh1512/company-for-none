use near_sdk::{env, near, AccountId, PanicOnDefault};
use near_sdk::store::Vector;

macro_rules! check_eq { ($a:expr, $b:expr, $msg:expr) => { near_sdk::require!($a == $b, $msg) }; }

const ZERO: &str = "0000000000000000000000000000000000000000000000000000000000000000";

#[near(serializers = [borsh, json])]
#[derive(Clone, PartialEq, Debug)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Record {
    pub sequence: u64,
    pub r#type: String,
    pub at: String,
    pub actor_hash: String,
    pub payload_hash: String,
    pub previous_hash: String,
    pub hash: String,
}

#[near(serializers = [json])]
#[serde(rename_all = "camelCase")]
pub struct Head {
    pub company_hash: String,
    pub sequence: u64,
    pub hash: String,
    pub owner_id: AccountId,
    pub writer_id: Option<AccountId>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct CompanyLedger {
    owner_id: AccountId,
    writer_id: Option<AccountId>,
    company_hash: String,
    records: Vector<Record>,
}

fn is_hash(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[near]
impl CompanyLedger {
    /// Deploy + initialize atomically from this contract account. Nobody can claim
    /// another owner's newly deployed contract by racing a public init call.
    #[init]
    pub fn new(company_hash: String, writer_id: Option<AccountId>) -> Self {
        check_eq!(env::predecessor_account_id(), env::current_account_id(), "SELF_INIT_REQUIRED");
        near_sdk::require!(is_hash(&company_hash), "INVALID_COMPANY_HASH");
        Self { owner_id: env::current_account_id(), writer_id, company_hash, records: Vector::new(b"r") }
    }

    /// Only the deployment owner may explicitly bind/rotate the operational writer.
    /// No writer may upgrade code, clear records, change company or transfer funds.
    pub fn set_writer(&mut self, writer_id: Option<AccountId>) {
        check_eq!(env::predecessor_account_id(), self.owner_id, "OWNER_REQUIRED");
        self.writer_id = writer_id;
    }

    pub fn get_head(&self) -> Head {
        let sequence = self.records.len() as u64;
        let hash = self.records.len().checked_sub(1).and_then(|i| self.records.get(i)).map(|r| r.hash.clone()).unwrap_or_else(|| ZERO.to_string());
        Head { company_hash: self.company_hash.clone(), sequence, hash, owner_id: self.owner_id.clone(), writer_id: self.writer_id.clone() }
    }

    pub fn get_records(&self, from_sequence: u64, limit: u32) -> Vec<Record> {
        near_sdk::require!((1..=50).contains(&limit) && from_sequence >= 1, "INVALID_PAGE");
        let start = u32::try_from(from_sequence - 1).expect("INVALID_SEQUENCE");
        (start..self.records.len().min(start.saturating_add(limit)))
            .filter_map(|i| self.records.get(i).cloned()).collect()
    }

    pub fn append(&mut self, company_hash: String, expected_sequence: u64, expected_hash: String, records: Vec<Record>) -> Head {
        near_sdk::require!(self.writer_id.as_ref() == Some(&env::predecessor_account_id()), "WRITER_REQUIRED");
        check_eq!(company_hash, self.company_hash, "COMPANY_MISMATCH");
        near_sdk::require!(!records.is_empty() && records.len() <= 50, "INVALID_BATCH_SIZE");
        near_sdk::require!(is_hash(&expected_hash), "INVALID_HASH");
        near_sdk::require!(expected_sequence <= self.records.len() as u64, "HEAD_MISMATCH");
        let actual_previous = if expected_sequence == 0 { ZERO } else {
            &self.records.get(u32::try_from(expected_sequence - 1).expect("INVALID_SEQUENCE")).expect("HEAD_MISMATCH").hash
        };
        check_eq!(actual_previous, expected_hash, "HEAD_MISMATCH");
        let mut previous = expected_hash;
        // Validate the whole batch before changing any storage.
        for (index, record) in records.iter().enumerate() {
            check_eq!(record.sequence, expected_sequence + index as u64 + 1, "SEQUENCE_GAP");
            near_sdk::require!(record.sequence <= 9_007_199_254_740_991, "INVALID_SEQUENCE");
            check_eq!(record.previous_hash, previous, "HASH_CHAIN_MISMATCH");
            near_sdk::require!(is_hash(&record.actor_hash) && is_hash(&record.payload_hash) && is_hash(&record.hash), "INVALID_HASH");
            near_sdk::require!(!record.r#type.is_empty() && record.r#type.len() <= 96 && record.r#type.bytes().all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b)), "INVALID_TYPE");
            near_sdk::require!(record.at.len() == 24 && record.at.ends_with('Z') && record.at.bytes().all(|b| b.is_ascii_digit() || b"-:TZ.".contains(&b)), "INVALID_TIMESTAMP");
            let input = ["company-ledger:record:v1", &company_hash, &record.sequence.to_string(), &record.r#type, &record.at, &record.actor_hash, &record.payload_hash, &record.previous_hash].join("\n");
            check_eq!(hex(&env::sha256(input.as_bytes())), record.hash, "RECORD_HASH_MISMATCH");
            previous = record.hash.clone();
        }
        if expected_sequence < self.records.len() as u64 {
            // Whole-batch replay only: never append a partially overlapping batch.
            near_sdk::require!(expected_sequence + records.len() as u64 <= self.records.len() as u64, "PARTIAL_OVERLAP");
            for r in &records { check_eq!(self.records.get((r.sequence - 1) as u32), Some(r), "REPLAY_CONFLICT"); }
            return self.get_head();
        }
        for r in records { self.records.push(r); }
        self.get_head()
    }
}
