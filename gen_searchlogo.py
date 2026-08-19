from PIL import Image, ImageDraw, ImageFont

# Reproduce the go.mail.ru 2010 search logo: white "Поиск" + orange "@domain"
# Original logoback.png is 200x39. We widen it to fit the longer domain.
FONT = 'C:/Windows/Fonts/arialbd.ttf'
SIZE = 26
WHITE = (255, 255, 255, 255)
ORANGE = (248, 172, 50, 255)

left = 'Поиск'
right = '@soap.nekxd.fun'

f = ImageFont.truetype(FONT, SIZE)
probe = ImageDraw.Draw(Image.new('RGBA', (10, 10)))

def metrics(t):
    b = probe.textbbox((0, 0), t, font=f)
    return b  # (l, t, r, b)

lb = metrics(left)
rb = metrics(right)
lw = lb[2] - lb[0]
rw = rb[2] - rb[0]

gap = 6
H = 39
pad_l = 2
W = pad_l + lw + gap + rw + 4

img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# vertical centering: original text sits roughly baseline ~ y=31
base_y = 6
d.text((pad_l - lb[0], base_y - lb[1]), left, font=f, fill=WHITE)
x2 = pad_l + lw + gap
d.text((x2 - rb[0], base_y - rb[1]), right, font=f, fill=ORANGE)

img.save('assets/img/gi/img/mail/logoback.png')
print('saved', W, H, 'left_w', lw, 'right_w', rw, 'right_x', x2)
