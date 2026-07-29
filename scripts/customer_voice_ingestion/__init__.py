"""Public customer-voice evidence adapters.

Adapters are intentionally imported and executed by ``collect_customer_voice.py`` in
the order approved for this project.  Each module is independently controlled by its
own ``CUSTOMER_VOICE_*_ENABLED`` environment variable.
"""

from .common import SOURCE_CREDIBILITY, EvidenceRecord

__all__ = ["SOURCE_CREDIBILITY", "EvidenceRecord"]
