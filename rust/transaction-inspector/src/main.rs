use base64::{Engine, engine::general_purpose::STANDARD};
use serde::Serialize;
use std::io::{self, Read};

#[derive(Debug)]
struct Cursor<'a> {
    bytes: &'a [u8],
    position: usize,
}

impl<'a> Cursor<'a> {
    fn new(bytes: &'a [u8]) -> Self {
        Self { bytes, position: 0 }
    }

    fn read_u8(&mut self) -> Result<u8, String> {
        let value = *self
            .bytes
            .get(self.position)
            .ok_or_else(|| "transaction ended unexpectedly".to_string())?;
        self.position += 1;
        Ok(value)
    }

    fn read_bytes(&mut self, length: usize) -> Result<&'a [u8], String> {
        let end = self
            .position
            .checked_add(length)
            .ok_or_else(|| "transaction length overflowed".to_string())?;
        let value = self
            .bytes
            .get(self.position..end)
            .ok_or_else(|| "transaction ended unexpectedly".to_string())?;
        self.position = end;
        Ok(value)
    }

    fn read_short_vec(&mut self) -> Result<usize, String> {
        let mut value = 0usize;
        for shift in [0usize, 7, 14] {
            let byte = self.read_u8()?;
            value |= usize::from(byte & 0x7f) << shift;
            if byte & 0x80 == 0 {
                return Ok(value);
            }
        }
        Err("compact-u16 value is too large".to_string())
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Inspection {
    engine: &'static str,
    transaction_version: &'static str,
    byte_length: usize,
    signature_count: usize,
    required_signatures: usize,
    static_account_count: usize,
    writable_static_accounts: usize,
    writable_lookup_accounts: usize,
    writable_account_count: usize,
    instruction_count: usize,
    program_ids: Vec<String>,
    address_table_lookup_count: usize,
}

fn inspect_base64(input: &str) -> Result<Inspection, String> {
    let bytes = STANDARD
        .decode(input.trim())
        .map_err(|_| "input is not valid base64".to_string())?;
    inspect_bytes(&bytes)
}

fn inspect_bytes(bytes: &[u8]) -> Result<Inspection, String> {
    if bytes.is_empty() {
        return Err("transaction is empty".to_string());
    }
    if bytes[0] == 0x81 {
        return Err(
            "Solana v1 transactions are recognized but not decoded by this MVP".to_string(),
        );
    }

    let mut cursor = Cursor::new(bytes);
    let signature_count = cursor.read_short_vec()?;
    cursor.read_bytes(signature_count.saturating_mul(64))?;

    let prefix = cursor.read_u8()?;
    let (transaction_version, required_signatures) = if prefix & 0x80 == 0 {
        ("legacy", usize::from(prefix))
    } else if prefix == 0x80 {
        ("v0", usize::from(cursor.read_u8()?))
    } else {
        return Err(format!(
            "unsupported Solana transaction version prefix 0x{prefix:02x}"
        ));
    };

    let readonly_signed = usize::from(cursor.read_u8()?);
    let readonly_unsigned = usize::from(cursor.read_u8()?);
    let static_account_count = cursor.read_short_vec()?;
    if required_signatures > static_account_count
        || readonly_signed > required_signatures
        || readonly_unsigned > static_account_count.saturating_sub(required_signatures)
    {
        return Err("transaction header contains invalid account counts".to_string());
    }

    let mut account_keys = Vec::with_capacity(static_account_count);
    for _ in 0..static_account_count {
        account_keys.push(cursor.read_bytes(32)?.to_vec());
    }
    cursor.read_bytes(32)?;

    let instruction_count = cursor.read_short_vec()?;
    let mut program_ids = Vec::new();
    for _ in 0..instruction_count {
        let program_index = usize::from(cursor.read_u8()?);
        let account_count = cursor.read_short_vec()?;
        cursor.read_bytes(account_count)?;
        let data_length = cursor.read_short_vec()?;
        cursor.read_bytes(data_length)?;
        let program_key = account_keys
            .get(program_index)
            .ok_or_else(|| "instruction references an invalid program account".to_string())?;
        let program_id = bs58::encode(program_key).into_string();
        if !program_ids.contains(&program_id) {
            program_ids.push(program_id);
        }
    }

    let mut address_table_lookup_count = 0usize;
    let mut writable_lookup_accounts = 0usize;
    if transaction_version == "v0" {
        address_table_lookup_count = cursor.read_short_vec()?;
        for _ in 0..address_table_lookup_count {
            cursor.read_bytes(32)?;
            let writable_count = cursor.read_short_vec()?;
            writable_lookup_accounts += writable_count;
            cursor.read_bytes(writable_count)?;
            let readonly_count = cursor.read_short_vec()?;
            cursor.read_bytes(readonly_count)?;
        }
    }

    if cursor.position != bytes.len() {
        return Err(format!(
            "transaction has {} unexpected trailing bytes",
            bytes.len() - cursor.position
        ));
    }

    let writable_signed = required_signatures - readonly_signed;
    let writable_unsigned = static_account_count - required_signatures - readonly_unsigned;
    let writable_static_accounts = writable_signed + writable_unsigned;

    Ok(Inspection {
        engine: "rust-wire-decoder",
        transaction_version,
        byte_length: bytes.len(),
        signature_count,
        required_signatures,
        static_account_count,
        writable_static_accounts,
        writable_lookup_accounts,
        writable_account_count: writable_static_accounts + writable_lookup_accounts,
        instruction_count,
        program_ids,
        address_table_lookup_count,
    })
}

fn main() {
    let mut input = String::new();
    if let Err(error) = io::stdin().read_to_string(&mut input) {
        eprintln!("failed to read stdin: {error}");
        std::process::exit(1);
    }

    match inspect_base64(&input) {
        Ok(report) => println!(
            "{}",
            serde_json::to_string(&report).expect("serialize report")
        ),
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(2);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const OFFICIAL_SAMPLE: &str = "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEEjNmKiZGiOtSZ+g0//wH5kEQo3+UzictY+KlLV8hjXcs44M/Xnr+1SlZsqS6cFMQc46yj9PIsxqkycxJmXT+veJjIvefX4nhY9rY+B5qreeqTHu4mG6Xtxr5udn4MN8PnBt324e51j94YQl285GzN2rYa/E2DuQ0n/r35KNihi/zamQ6EeyeeVDvPVgUO2W3Lgt9hT+CfyqHvIa11egFPCgEDAwIBAAkDZAAAAAAAAAA=";

    #[test]
    fn inspects_official_legacy_sample() {
        let report = inspect_base64(OFFICIAL_SAMPLE).expect("sample should decode");
        assert_eq!(report.transaction_version, "legacy");
        assert_eq!(report.signature_count, 1);
        assert_eq!(report.required_signatures, 1);
        assert_eq!(report.static_account_count, 4);
        assert_eq!(report.instruction_count, 1);
        assert_eq!(
            report.program_ids,
            vec!["TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]
        );
    }

    #[test]
    fn rejects_invalid_base64() {
        assert!(inspect_base64("not base64").is_err());
    }

    #[test]
    fn recognizes_v1_without_misparsing_it() {
        let error = inspect_bytes(&[0x81]).expect_err("v1 is intentionally explicit");
        assert!(error.contains("v1"));
    }
}
