import os
from PIL import Image, ImageDraw

icons_dir = os.path.join(os.path.dirname(__file__), 'extension', 'icons')
os.makedirs(icons_dir, exist_ok=True)

def create_icon(size):
    # Create image with RGBA
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background circle with vibrant modern teal/emerald gradient look
    # Main circle
    pad = max(1, int(size * 0.05))
    draw.ellipse([pad, pad, size - pad - 1, size - pad - 1], fill=(22, 163, 74, 255), outline=(16, 185, 129, 255), width=max(1, int(size * 0.04)))
    
    # Draw letter 'A' or stylized rocket/bolt in white
    # Let's draw stylized letter 'A' with a forward arrow
    w = size
    h = size
    
    # White shape - 'A' triangle
    top = (w * 0.5, h * 0.22)
    left = (w * 0.22, h * 0.78)
    right = (w * 0.78, h * 0.78)
    
    # Draw thick stroke A
    stroke_w = max(2, int(size * 0.12))
    draw.line([left, top], fill=(255, 255, 255, 255), width=stroke_w)
    draw.line([top, right], fill=(255, 255, 255, 255), width=stroke_w)
    # Crossbar
    bar_y = int(h * 0.58)
    bar_left = int(w * 0.33)
    bar_right = int(w * 0.67)
    draw.line([(bar_left, bar_y), (bar_right, bar_y)], fill=(255, 255, 255, 255), width=stroke_w)
    
    # Little gear or spark accent at top right
    accent_r = max(2, int(size * 0.1))
    accent_center = (int(w * 0.76), int(h * 0.26))
    draw.ellipse([accent_center[0] - accent_r, accent_center[1] - accent_r, accent_center[0] + accent_r, accent_center[1] + accent_r], fill=(250, 204, 21, 255))
    
    return img

for s in [16, 32, 48, 128]:
    icon = create_icon(s)
    path = os.path.join(icons_dir, f'icon{s}.png')
    icon.save(path, 'PNG')
    print(f"Generated {path}")
