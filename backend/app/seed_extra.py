"""Extended demo catalogue (listings 29-48).

These are appended after the original 28 listings and are seeded in a separate step with their own
random seed, so the original records (and the ids the tests rely on) never change. Photos are
hot-linked Unsplash images keyed in `seed_data.PHOTOS`.
"""

from app.seed_data import ListingSeed

# fmt: off
EXTRA_LISTINGS: list[ListingSeed] = [
    # ------------------------------------------------------------------ Kerala
    ListingSeed(
        host="arjun", title="Backwater houseboat with a sunset deck", city="Alleppey", country="India",
        location="Punnamada, Kerala, India", lat=9.4981, lng=76.3388, type="Boutique stay",
        category="lakefront", price=175, cleaning=30, service=25, guests=4, bedrooms=2, beds=2, baths=2,
        photos=["kerala_houseboat", "kerala_houseboat_b", "kerala_canal", "kerala_dusk", "bedroom_b"],
        amenities=["Wifi", "Air conditioning", "Breakfast included", "Private chef", "Lake access"],
        description="A teak-and-coir houseboat that drifts through the Alleppey backwaters with its own crew "
        "and cook. Sleep to the sound of water, breakfast on the open deck and watch the herons at sunset.",
    ),
    ListingSeed(
        host="arjun", title="Tea-estate bungalow above the clouds", city="Munnar", country="India",
        location="Munnar, Kerala, India", lat=10.0889, lng=77.0595, type="Cottage",
        category="countryside", price=125, cleaning=20, service=20, guests=5, bedrooms=2, beds=3, baths=2,
        photos=["munnar_hills", "munnar_valley", "tea_pickers", "tea_leaves", "living_wood"],
        amenities=["Wifi", "Fireplace", "Mountain view", "Breakfast included", "Free parking", "Heating"],
        description="A colonial-era planter's bungalow set between rows of tea. Mornings start with a pot of "
        "estate chai on the veranda and a walk through the plantation with the resident guide.",
    ),
    ListingSeed(
        host="arjun", title="Fort Kochi heritage home with a courtyard", city="Kochi", country="India",
        location="Fort Kochi, Kerala, India", lat=9.9658, lng=76.2421, type="Boutique stay",
        category="design", price=95, cleaning=15, service=15, guests=3, bedrooms=1, beds=2, baths=1,
        photos=["kochi_house", "kochi_arch", "kochi_colour", "courtyard_plants", "bedroom_d"],
        amenities=["Wifi", "Air conditioning", "Kitchen", "Workspace", "Breakfast included"],
        description="A restored Indo-Portuguese house a few minutes from the Chinese fishing nets and the "
        "gallery cafés. Slatted shutters, a shaded courtyard and a rooftop to watch the harbour at dusk.",
    ),
    # ----------------------------------------------------------------- Kashmir
    ListingSeed(
        host="arjun", title="Pine-view chalet in Pahalgam", city="Pahalgam", country="India",
        location="Pahalgam, Kashmir, India", lat=34.0161, lng=75.3150, type="Cabin",
        category="cabins", price=105, cleaning=20, service=15, guests=4, bedrooms=2, beds=3, baths=1,
        photos=["pahalgam_house", "pahalgam_meadow", "pahalgam_river", "pahalgam_valley", "bedroom_a"],
        amenities=["Wifi", "Fireplace", "Mountain view", "Heating", "Kitchen", "Free parking"],
        description="A timber chalet on the edge of a meadow, a short walk from the Lidder river. Warm "
        "kehwa on arrival, a wood-burning stove for cold evenings and trailheads at the front gate.",
    ),
    ListingSeed(
        host="arjun", title="Glacier-view lodge at Sonamarg", city="Sonamarg", country="India",
        location="Sonamarg, Kashmir, India", lat=34.3030, lng=75.2930, type="Mountain home",
        category="amazing-views", price=160, cleaning=25, service=20, guests=6, bedrooms=3, beds=4, baths=2,
        photos=["sonamarg_village", "sonamarg_ridge", "sonamarg_peaks", "living_leather", "bedroom_e"],
        amenities=["Wifi", "Fireplace", "Mountain view", "Heating", "Breakfast included", "Free parking"],
        description="A stone-and-timber lodge facing the Thajiwas glacier. Big windows frame the peaks and the "
        "host arranges pony rides, trout fishing and picnic lunches by the Sindh river.",
    ),
    # -------------------------------------------------------- Himachal Pradesh
    ListingSeed(
        host="arjun", title="Apple-orchard cottage in Kasol", city="Kasol", country="India",
        location="Kasol, Himachal Pradesh, India", lat=32.0100, lng=77.3150, type="Cottage",
        category="cabins", price=85, cleaning=15, service=10, guests=3, bedrooms=1, beds=2, baths=1,
        photos=["kasol_cabin", "kasol_peaks", "kasol_stream", "kasol_forest", "bedroom_f"],
        amenities=["Wifi", "Mountain view", "Heating", "Kitchen", "Pet friendly"],
        description="A small wooden cottage tucked into an apple orchard above the Parvati river. Wake up to "
        "snow on the ridge, cook on the terrace stove and walk to the village cafés in ten minutes.",
    ),
    ListingSeed(
        host="arjun", title="Colonial villa on the Shimla ridge", city="Shimla", country="India",
        location="The Ridge, Shimla, Himachal Pradesh, India", lat=31.1048, lng=77.1734, type="Luxury home",
        category="mansions", price=210, cleaning=40, service=30, guests=8, bedrooms=4, beds=5, baths=3,
        photos=["shimla_manor", "shimla_hillside", "shimla_estate", "shimla_red_roof", "living_frames"],
        amenities=["Wifi", "Fireplace", "Mountain view", "Free parking", "Kitchen", "Breakfast included"],
        description="A gabled Raj-era villa with deodar floors, a library and a lawn that looks across the "
        "valley. A caretaker and cook look after you; the Mall Road is a gentle stroll away.",
    ),
    # --------------------------------------------------------------- Rajasthan
    ListingSeed(
        host="arjun", title="Pool haveli below Amer Fort", city="Jaipur", country="India",
        location="Amer, Jaipur, India", lat=26.9855, lng=75.8513, type="Villa",
        category="pools", price=260, cleaning=45, service=35, guests=8, bedrooms=4, beds=5, baths=4,
        photos=["amer_fort_path", "amer_fort_wall", "amer_lake", "tropical_pool", "living_leather"],
        amenities=["Wifi", "Pool", "Air conditioning", "Private chef", "Free parking", "Kitchen", "TV"],
        description="A courtyard haveli with a walled garden and a plunge pool, ten minutes from Amer Fort. "
        "Evening dinners are cooked by the house chef and served under the stars.",
    ),
    ListingSeed(
        host="arjun", title="Lake Pichola palace suite", city="Udaipur", country="India",
        location="City Palace Road, Udaipur, India", lat=24.5760, lng=73.6800, type="Boutique stay",
        category="lakefront", price=230, cleaning=35, service=30, guests=3, bedrooms=1, beds=2, baths=1,
        photos=["udaipur_palace", "udaipur_lake", "udaipur_balcony", "udaipur_dusk", "bedroom_luxe"],
        amenities=["Wifi", "Air conditioning", "Lake access", "Breakfast included", "Workspace"],
        description="A balcony suite in a small heritage hotel with a front-row view of the lake and the City "
        "Palace. Boat rides at golden hour leave from the ghat steps below.",
    ),
    # ------------------------------------------------------------- Uttarakhand
    ListingSeed(
        host="arjun", title="Ganga-view treehouse in Rishikesh", city="Rishikesh", country="India",
        location="Tapovan, Uttarakhand, India", lat=30.1330, lng=78.3170, type="Cabin",
        category="omg", price=90, cleaning=15, service=10, guests=2, bedrooms=1, beds=1, baths=1,
        photos=["ganga_sunset", "ganga_valley", "himalaya_terraces", "log_cabin_forest", "bedroom_a"],
        amenities=["Wifi", "Mountain view", "Breakfast included", "Pet friendly"],
        description="A treehouse among the canopy above the Ganges, reached by a short stair through the "
        "forest. Yoga on the deck at sunrise, riverside cafés and rafting a short ride away.",
    ),
    # -------------------------------------------------------------- Chandigarh
    ListingSeed(
        host="arjun", title="Modernist family home in Sector 9", city="Chandigarh", country="India",
        location="Sector 9, Chandigarh, India", lat=30.7415, lng=76.7681, type="Villa",
        category="design", price=140, cleaning=25, service=20, guests=6, bedrooms=3, beds=4, baths=2,
        photos=["chandigarh_avenue", "chandigarh_road", "chandigarh_blossom", "living_a", "kitchen_a"],
        amenities=["Wifi", "Air conditioning", "Kitchen", "Free parking", "Workspace", "TV", "Washer"],
        description="An airy brutalist-era house in the planned city's leafiest sector, with a garden courtyard "
        "and original jali screens. Rock Garden and Sukhna Lake are both a short drive away.",
    ),
    # ----------------------------------------------------------- International
    ListingSeed(
        host="sofia", title="Bright Marais loft above a courtyard", city="Paris", country="France",
        location="Le Marais, Paris, France", lat=48.8566, lng=2.3622, type="Loft",
        category="iconic-cities", price=185, cleaning=30, service=25, guests=3, bedrooms=1, beds=2, baths=1,
        photos=["marais_facade", "paris_balconies", "loft", "living_b", "bedroom_f"],
        amenities=["Wifi", "Kitchen", "Workspace", "Heating", "TV", "Washer"],
        description="A top-floor loft with exposed beams and tall windows over a quiet Marais courtyard. "
        "Bakeries, galleries and the Place des Vosges are all on your doorstep.",
    ),
    ListingSeed(
        host="oliver", title="Notting Hill mews house", city="London", country="United Kingdom",
        location="Notting Hill, London, UK", lat=51.5090, lng=-0.2050, type="Luxury home",
        category="mansions", price=410, cleaning=60, service=45, guests=6, bedrooms=3, beds=4, baths=3,
        photos=["london_mews", "notting_hill_colour", "notting_hill_crescent", "living_frames", "bedroom_e"],
        amenities=["Wifi", "Kitchen", "Heating", "Workspace", "TV", "Washer", "Fireplace"],
        description="A pastel-fronted mews house on a cobbled lane, steps from Portobello Road. Three floors "
        "of calm, a fireplace in the sitting room and a small walled terrace for breakfast.",
    ),
    ListingSeed(
        host="nia", title="West Village garden studio", city="New York", country="United States",
        location="West Village, New York, USA", lat=40.7358, lng=-74.0036, type="Apartment",
        category="iconic-cities", price=190, cleaning=35, service=30, guests=2, bedrooms=1, beds=1, baths=1,
        photos=["west_village", "nyc_autumn", "nyc_avenue", "living_blue", "kitchen_b"],
        amenities=["Wifi", "Kitchen", "Air conditioning", "Workspace", "TV", "Washer"],
        description="A tree-lined brownstone block, a private garden entrance and a bright studio with a "
        "proper kitchen. Cafés, jazz clubs and the Hudson River path are all within a few blocks.",
    ),
    ListingSeed(
        host="kenji", title="Machiya townhouse in old Kyoto", city="Kyoto", country="Japan",
        location="Higashiyama, Kyoto, Japan", lat=35.0116, lng=135.7681, type="Boutique stay",
        category="design", price=205, cleaning=35, service=25, guests=4, bedrooms=2, beds=3, baths=1,
        photos=["kyoto_eaves", "kyoto_machiya", "kyoto_garden", "kyoto_doors", "bedroom_d"],
        amenities=["Wifi", "Air conditioning", "Kitchen", "Heating", "Workspace"],
        description="A wooden machiya with tatami rooms, a stone courtyard garden and a deep soaking tub. "
        "Temples and tea houses are a walk away, and the host will book a kaiseki dinner on request.",
    ),
    ListingSeed(
        host="kenji", title="Rice-terrace villa with a plunge pool", city="Ubud", country="Indonesia",
        location="Tegallalang, Bali, Indonesia", lat=-8.4312, lng=115.2793, type="Villa",
        category="pools", price=175, cleaning=30, service=25, guests=4, bedrooms=2, beds=2, baths=2,
        photos=["rice_terraces", "bali_palms_house", "bali_green", "infinity_deck", "bath_tub"],
        amenities=["Wifi", "Pool", "Air conditioning", "Breakfast included", "Kitchen", "Free parking"],
        description="Two open-sided pavilions on the edge of the Tegallalang terraces with a private plunge "
        "pool. A daily breakfast hamper arrives at your door and scooters are on hand for temple hopping.",
    ),
    ListingSeed(
        host="nia", title="Downtown sky-view apartment", city="Dubai", country="United Arab Emirates",
        location="Downtown Dubai, Dubai, UAE", lat=25.1972, lng=55.2744, type="Apartment",
        category="iconic-cities", price=290, cleaning=40, service=35, guests=4, bedrooms=2, beds=2, baths=2,
        photos=["downtown_dubai", "dubai_towers", "living_white", "bedroom_luxe", "kitchen_a"],
        amenities=["Wifi", "Pool", "Gym", "Air conditioning", "Free parking", "Kitchen", "TV"],
        description="A high-floor apartment with floor-to-ceiling views of the Burj Khalifa fountains. The "
        "building has a rooftop pool and gym, and the Dubai Mall is a covered walk away.",
    ),
    ListingSeed(
        host="sofia", title="Tiled Alfama flat with river views", city="Lisbon", country="Portugal",
        location="Alfama, Lisbon, Portugal", lat=38.7139, lng=-9.1334, type="Apartment",
        category="design", price=120, cleaning=20, service=18, guests=3, bedrooms=1, beds=2, baths=1,
        photos=["lisbon_roofs", "lisbon_facade", "lisbon_tiles", "apt_a", "bedroom_a"],
        amenities=["Wifi", "Kitchen", "Air conditioning", "Workspace", "Washer"],
        description="A sunny flat behind a hand-painted azulejo facade, with a balcony over the red rooftops "
        "and the Tagus. Fado bars and the tram 28 stop are a minute's walk.",
    ),
    ListingSeed(
        host="sofia", title="Cliffside villa above Positano", city="Positano", country="Italy",
        location="Positano, Amalfi Coast, Italy", lat=40.6281, lng=14.4850, type="Villa",
        category="amazing-views", price=450, cleaning=70, service=55, guests=6, bedrooms=3, beds=4, baths=3,
        photos=["positano_dawn", "positano_sea", "positano_stairs", "white_villa", "bath_dark"],
        amenities=["Wifi", "Air conditioning", "Kitchen", "Breakfast included", "TV", "Private chef"],
        description="A whitewashed villa stacked into the cliff with terraces facing the Tyrrhenian Sea. "
        "Lemon trees shade the breakfast table and the beach is a scenic stair-walk down.",
    ),
    ListingSeed(
        host="oliver", title="Wooden chalet below the Matterhorn", city="Zermatt", country="Switzerland",
        location="Zermatt, Valais, Switzerland", lat=46.0207, lng=7.7491, type="Cabin",
        category="cabins", price=380, cleaning=60, service=45, guests=6, bedrooms=3, beds=4, baths=2,
        photos=["alpine_house", "alpine_chalets", "alpine_village", "log_lodge_dusk", "living_wood"],
        amenities=["Wifi", "Fireplace", "Hot tub", "Mountain view", "Heating", "Kitchen"],
        description="A traditional larch chalet with a hot tub on the balcony and a ski room by the door. "
        "The village is car-free, so you'll arrive by electric taxi and leave your boots by the fire.",
    ),
]
# fmt: on
