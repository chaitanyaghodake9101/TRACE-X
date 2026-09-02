import os
import io
import re
import csv
import json
from datetime import datetime
from typing import Tuple, Dict, Any, Optional

def extract_text_from_file(file_bytes: bytes, filename: str, content_type: Optional[str] = None) -> Tuple[str, Dict[str, Any]]:
    """
    Extracts text and metadata from uploaded synthetic files (TXT, CSV, JSON, PDF).
    """
    filename_lower = filename.lower()
    metadata: Dict[str, Any] = {
        "original_filename": filename,
        "file_size_bytes": len(file_bytes),
        "extracted_at": datetime.utcnow().isoformat()
    }

    # 1. Plain Text / Markdown / Log files
    if filename_lower.endswith(('.txt', '.log', '.md')) or (content_type and "text/plain" in content_type):
        try:
            text = file_bytes.decode('utf-8', errors='ignore')
            metadata["format"] = "plain_text"
            metadata["line_count"] = len(text.splitlines())
            return text, metadata
        except Exception as e:
            return f"Error reading text: {str(e)}", metadata

    # 2. CSV Files (e.g. CDR logs or Financial transaction exports)
    elif filename_lower.endswith('.csv') or (content_type and "csv" in content_type):
        try:
            text_stream = io.StringIO(file_bytes.decode('utf-8', errors='ignore'))
            reader = csv.reader(text_stream)
            rows = list(reader)
            formatted_lines = []
            if rows:
                header = rows[0]
                metadata["csv_columns"] = header
                metadata["row_count"] = max(0, len(rows) - 1)
                formatted_lines.append(f"CSV Header: {', '.join(header)}")
                for idx, row in enumerate(rows[1:], start=1):
                    formatted_lines.append(f"Row {idx}: {', '.join(row)}")
            text = "\n".join(formatted_lines)
            metadata["format"] = "csv"
            return text, metadata
        except Exception as e:
            return f"Error parsing CSV: {str(e)}", metadata

    # 3. JSON Files (e.g. Bank Statements or Intercept Data)
    elif filename_lower.endswith('.json') or (content_type and "application/json" in content_type):
        try:
            json_obj = json.loads(file_bytes.decode('utf-8', errors='ignore'))
            text = json.dumps(json_obj, indent=2)
            metadata["format"] = "json"
            metadata["json_keys"] = list(json_obj.keys()) if isinstance(json_obj, dict) else []
            return text, metadata
        except Exception as e:
            return f"Error parsing JSON: {str(e)}", metadata

    # 4. Fallback UTF-8 text extraction
    else:
        text = file_bytes.decode('utf-8', errors='ignore')
        metadata["format"] = "raw_fallback"
        return text, metadata

def extract_metadata_heuristics(text: str, source_type: str) -> Dict[str, Any]:
    """
    Extracts high-level heuristic metadata tags from synthetic investigation documents.
    """
    heuristics: Dict[str, Any] = {}

    # Detect Indian Phone Numbers (+91 or 10-digit mobile)
    phone_pattern = r'(?:\+91[\-\s]?)?[6-9]\d{9}'
    phones = list(set(re.findall(phone_pattern, text)))
    if phones:
        heuristics["detected_phone_numbers"] = phones[:10]

    # Detect Currency / Transaction Amounts (INR / Rs / ₹)
    amount_pattern = r'(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)'
    amounts = re.findall(amount_pattern, text, re.IGNORECASE)
    if amounts:
        heuristics["detected_monetary_amounts"] = amounts[:10]

    # Detect Vehicle Registration Numbers (Indian format e.g. MH-12-AB-1234 or DL01AB1234)
    vehicle_pattern = r'[A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{4}'
    vehicles = list(set(re.findall(vehicle_pattern, text)))
    if vehicles:
        heuristics["detected_vehicle_numbers"] = vehicles[:10]

    # Word & Character Count for completeness evaluation
    heuristics["char_count"] = len(text)
    heuristics["word_count"] = len(text.split())

    return heuristics
