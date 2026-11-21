from pydantic import BaseModel


class ForcesSummary(BaseModel):
    status: str  # "none" | "queued" | "importing" | "loaded" | "invalid"
    notes: str | None = None
    n_records: int = 0
    n_elements_with_forces: int = 0
    n_load_cases: int = 0
    load_cases: list[str] = []
