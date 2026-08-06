"""Maps hub area slugs to neighborhoods included when filtering."""

NEIGHBORHOOD_GROUP_EXPANSIONS: dict[str, list[str]] = {
    "nyarugenge": ["nyarugenge", "kiyovu", "nyamirambo"],
    "gasabo": [
        "gasabo",
        "nyarutarama",
        "kibagabaga",
        "gisozi",
        "remera",
        "gacuriro",
        "kacyiru",
        "kimihurura",
        "kimironko",
        "kagugu",
    ],
    "kicukiro": ["kicukiro", "rebero", "kagarama"],
    "bugesera": ["bugesera"],
    "musanze": ["musanze"],
}


def expanded_neighborhood_slugs(slug: str) -> list[str]:
    key = slug.lower()
    if key in NEIGHBORHOOD_GROUP_EXPANSIONS:
        return NEIGHBORHOOD_GROUP_EXPANSIONS[key]
    return [key]
