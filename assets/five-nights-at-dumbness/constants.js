// constants.js
export const COLORS = {
    // Environment
    SKY_DARK: 0x111122, // Dark blue/purple night sky
    GROUND: 0x3a3a3a,   // Dark grey ground
    WALL: 0x888877,     // Drab beige/grey walls
    FLOOR: 0x666666,    // Dark grey concrete floor
    CEILING: 0x777777,  // Slightly lighter grey ceiling
    FENCE: 0x444444,    // Dark metal fence
    HIGHWAY: 0x222222,  // Very dark asphalt
    FURNITURE: 0x964B00, // Simple brown for furniture
    // Lighting
    AMBIENT_LIGHT: 0x404040, // Dim ambient light
    MAIN_LIGHT: 0xffccaa, // Warmish point light (like an incandescent bulb)

    // Characters (Simplified Toy Story Palette)
    WOODY_BODY: 0xDAA520, // Goldenrod (vest-ish) / Blue jeans mix (simplified)
    WOODY_HEAD: 0xFFE4B5, // Moccasin (skin tone)
    WOODY_HAT: 0x8B4513,  // SaddleBrown

    BUZZ_TORSO: 0xFFFFFF, // White
    BUZZ_HELMET: 0x9370DB, // MediumPurple (transparent)
    BUZZ_ACCENT: 0x32CD32, // LimeGreen
    // Traffic Colors
    CAR_RED: 0xff0000,
    CAR_BLUE: 0x0000ff,
    CAR_YELLOW: 0xffff00,
    CAR_GREEN: 0x00ff00,
};

export const SIZES = {
    BUILDING_WIDTH: 20,
    BUILDING_DEPTH: 25,
    BUILDING_HEIGHT: 4,
    PLAYER_HEIGHT: 1.7, // Average human height for camera Y position
};
