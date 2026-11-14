use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::io::{self, Read};

fn hash(v: &Value) -> String { format!("{:x}", Sha256::digest(serde_json::to_vec(v).unwrap())) }
fn safe(s: &str) -> bool {
    let mut c=s.chars(); matches!(c.next(),Some(x) if x.is_ascii_alphabetic()) && s.len()<=64 && c.all(|x|x.is_ascii_alphanumeric()||x=='_')
}
fn observe(schema: &Value, required: &[Value], cases: &[Value]) -> Value {
    let fields=schema["fields"].as_array().cloned().unwrap_or_default();
    let names:Vec<&str>=fields.iter().filter_map(|v|v["name"].as_str()).collect();
    let valid=!fields.is_empty()&&names.len()==fields.len()&&names.iter().all(|n|safe(n))&&names.iter().collect::<std::collections::HashSet<_>>().len()==names.len();
    let requirements=required.iter().all(|n|fields.iter().any(|f|f["name"]==*n&&f["required"]==true));
    let results:Vec<Value>=cases.iter().enumerate().map(|(i,input)|{
        let accepted=valid&&fields.iter().filter(|f|f["required"]==true).all(|f|input[f["name"].as_str().unwrap_or("")].as_str().is_some_and(|s|!s.is_empty()));
        let rendered:Vec<Value>=if accepted {fields.iter().filter(|f|input.get(f["name"].as_str().unwrap_or("")).is_some()).map(|f|f["name"].clone()).collect()}else{vec![]};
        let passed=accepted==(i==0)&&(i!=0||required.iter().all(|r|rendered.contains(r)));
        json!({"inputHash":hash(input),"accepted":accepted,"expectedAcceptance":i==0,"renderedFields":rendered,"passed":passed})
    }).collect();
    let passed=valid&&requirements&&results.iter().all(|r|r["passed"]==true);
    json!({"schemaValid":valid,"requirementsMet":requirements,"cases":results,"passed":passed})
}
fn main(){
    let mut bytes=Vec::new();io::stdin().take(262145).read_to_end(&mut bytes).unwrap();assert!(bytes.len()<=262144,"input bound");
    let input:Value=serde_json::from_slice(&bytes).expect("JSON input");assert_eq!(input["operation"],"evaluate_template");
    let spec=&input["spec"];let required=spec["contract"]["requiredFields"].as_array().expect("fixed contract");assert!(!required.is_empty()&&required.len()<=64&&required.iter().all(|v|v.as_str().is_some_and(safe)),"required fields");
    let mut cases=vec![];
    for missing in std::iter::once(None).chain(required.iter().map(Some)) {
        let mut case=serde_json::Map::new();for n in required {if Some(n)!=missing {let s=n.as_str().unwrap();case.insert(s.into(),json!(format!("sample:{s}")));}}cases.push(Value::Object(case));
    }
    let old=observe(&spec["baseline"],required,&cases);let next=observe(&spec["candidate"],required,&cases);
    let base=spec["baseline"]["fields"].as_array().expect("baseline fields");let candidate=spec["candidate"]["fields"].as_array().expect("candidate fields");assert!(base.len()<=64&&candidate.len()<=64);
    let preserves=base.iter().all(|o|candidate.iter().any(|n|n["name"]==o["name"]&&(o["required"]!=true||n["required"]==true)));
    let driver=json!({"version":"company-template-additive-v1","tests":["required_fields","preserve_fields","unique_fields","safe_identifiers","reject_missing_required","render_all_required"]});
    let output=json!({"evaluatorVersion":"company-template-additive-v1","evaluatorHash":hash(&driver),"testSetHash":hash(&json!({"driver":driver,"contract":spec["contract"],"cases":cases})),"contractHash":hash(&spec["contract"]),"oldHash":hash(&spec["baseline"]),"newHash":hash(&spec["candidate"]),"repaired":old["passed"]!=true&&next["passed"]==true&&preserves,"baseline":old,"candidate":next,"preservesFields":preserves});
    println!("{}",serde_json::to_string(&output).unwrap());
}
