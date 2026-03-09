#!/usr/bin/env python3
"""
Generate 1000 challenging support tickets.
Mix of clear cases, edge cases, ambiguous, angry, typos, multi-issue, etc.
"""

import random
import csv

# Templates by category with difficulty levels
TEMPLATES = {
    "billing_issue": [
        # Clear
        "I was charged ${amount} but my order was only ${lower_amount}",
        "Why was I billed twice for the same order?",
        "I see an unauthorized charge on my statement from your company",
        "My credit card was charged but I never completed checkout",
        "Need a receipt for order #{order_id}",
        # Ambiguous (could be refund)
        "I need my money back, you charged me wrong",
        "The price on the website was different from what I paid",
        "Your system took money from my account without permission",
        # Angry
        "THIS IS FRAUD!!! You charged me {amount} I NEVER AUTHORIZED THIS",
        "What the hell is this charge for?? I demand an explanation NOW",
        "I'm calling my bank to dispute this, your company is a scam",
        # Typos/casual
        "yo i got charged twic for my ordr can u fix",
        "um theres a werid charge on my acount??",
        "chraged me $50 insted of $30 pls refund diff",
        # Multi-issue
        "I was overcharged AND the item arrived damaged",
        "Wrong charge amount plus I never got a confirmation email",
        # Indirect
        "My bank statement shows something I don't recognize from you guys",
        "I'm looking at my credit card bill and something doesn't add up",
    ],

    "account_access": [
        # Clear
        "I forgot my password and the reset email never arrived",
        "Can't log into my account, says invalid credentials",
        "I need to change the email address on my account",
        "How do I enable two-factor authentication?",
        "My account got locked after too many login attempts",
        # Ambiguous
        "I can't get in",
        "Something's wrong with my account",
        "The app isn't letting me do anything",
        # Angry
        "I'VE BEEN LOCKED OUT FOR 3 DAYS FIX THIS NOW",
        "Your stupid website won't let me login even with correct password",
        "This is ridiculous, I can't access MY OWN account",
        # Typos
        "cant login plz hlp",
        "fogot pasword reset not workng",
        "my accout is broken i think",
        # Security concerns
        "Someone else might have access to my account",
        "I got an email about a login from a different country, wasn't me",
        "I think my account was hacked, please help",
    ],

    "order_issue": [
        # Clear
        "I received a blue shirt but I ordered red",
        "The package was missing 2 items from my order",
        "Item arrived broken/damaged",
        "Received someone else's order by mistake",
        "The product doesn't match the description on your website",
        # Ambiguous (could be return)
        "This isn't what I ordered at all",
        "Wrong item, what do I do now?",
        "I got something completely different",
        # Angry
        "ARE YOU KIDDING ME?? THIS IS NOT WHAT I ORDERED",
        "Second time you've sent me the wrong item. Unbelievable.",
        "Damaged AGAIN. Your packaging is a joke.",
        # Casual
        "lol you guys sent me the wrong size again",
        "soo this definitely isnt what i ordered haha",
        "package came all smashed up :(",
        # Detailed
        "Order #{order_id}: I ordered the 64GB version but received 32GB. The color is also wrong - ordered Space Gray, got Silver.",
    ],

    "shipping_inquiry": [
        # Clear
        "When will my order arrive?",
        "What's the tracking number for my order?",
        "Do you ship to Canada?",
        "Can I change my shipping address?",
        "How long does express shipping take?",
        # Ambiguous (could be order issue)
        "Where's my stuff?",
        "It's been 2 weeks, nothing",
        "Still waiting...",
        # Frustrated
        "My package has been 'in transit' for 10 days, what's going on?",
        "Tracking hasn't updated in a week, is it lost?",
        "This is taking way too long",
        # Casual
        "hey any idea when my order ships?",
        "whats the eta on order {order_id}",
        "yo is this thing ever gonna show up lol",
        # Specific
        "Can you ship to a PO Box?",
        "Do you offer same-day delivery in NYC?",
        "What carrier do you use for international orders?",
    ],

    "cancellation": [
        # Clear
        "I want to cancel my order",
        "Please cancel order #{order_id}",
        "I need to cancel my subscription",
        "Cancel my account please",
        "I changed my mind, please cancel",
        # Ambiguous (could be return)
        "I don't want this anymore",
        "How do I stop this order?",
        "Nevermind on my purchase",
        # Urgent
        "CANCEL IMMEDIATELY order has not shipped yet",
        "Please cancel ASAP I ordered by mistake",
        "Stop the shipment, I need to cancel",
        # Subscription specific
        "How do I cancel auto-renewal?",
        "I want to stop being charged monthly",
        "End my membership",
        # Indirect
        "I no longer need this service",
        "I'd like to discontinue my account",
        "Please remove me from your billing",
    ],

    "return_refund": [
        # Clear
        "I want to return this item",
        "How do I initiate a return?",
        "What's your refund policy?",
        "I need a return shipping label",
        "When will I get my refund?",
        # Ambiguous
        "I want my money back",
        "This needs to go back",
        "Take it back please",
        # Frustrated
        "I've been waiting 3 weeks for my refund, where is it?",
        "You said 5-7 days for refund, it's been 14",
        "I returned this a month ago and still no refund",
        # Specific situations
        "Item was a gift, can I return without receipt?",
        "Product is defective, need full refund including shipping",
        "Changed my mind within 24 hours, want to return",
        # Casual
        "can i return somethin i bought last month",
        "how do returns work here",
        "need to send this back its too small",
    ],

    "product_question": [
        # Clear
        "Is this product compatible with iPhone 15?",
        "What are the dimensions of this item?",
        "Is this available in other colors?",
        "When will this be back in stock?",
        "What material is this made of?",
        # Pre-purchase
        "Thinking about buying this, does it come with batteries?",
        "Can you tell me more about the warranty?",
        "Is the large size true to fit?",
        # Ambiguous
        "Will this work for me?",
        "Is this good?",
        "Tell me about this product",
        # Specific/technical
        "What's the thread count on these sheets?",
        "Is this compatible with 220V power?",
        "Does this support Bluetooth 5.0?",
        # Comparison
        "What's the difference between the Pro and regular version?",
        "Is Model X better than Model Y?",
    ],

    "technical_support": [
        # Clear
        "The app crashes when I try to checkout",
        "I'm getting an error message: '{error_code}'",
        "The website is not loading properly",
        "My download is stuck at 99%",
        "The feature X is not working",
        # Vague
        "It's broken",
        "Something's wrong",
        "Not working",
        "App is buggy",
        # Detailed
        "On iOS 17.2, the app freezes when I tap the cart icon. Have tried reinstalling.",
        "Getting 'Error 502' on Chrome but Safari works fine",
        "The payment button is grayed out and I can't click it",
        # Frustrated
        "Your app is TERRIBLE it crashes every 5 minutes",
        "This is the buggiest website I've ever used",
        "Fix your broken app!!!",
        # Casual
        "app keeps crashing halp",
        "website is being weird rn",
        "cant get this thing to work lol",
    ],

    "feedback": [
        # Positive
        "Just wanted to say your customer service is amazing!",
        "Love the new update, great job!",
        "Best purchase I've made all year",
        "Shoutout to Sarah from support, she was incredibly helpful",
        # Negative
        "Your service has really gone downhill",
        "Disappointed with recent changes to the app",
        "Used to love this company but not anymore",
        "Quality is not what it used to be",
        # Suggestions
        "You should add a dark mode to the app",
        "It would be great if you offered gift wrapping",
        "Please bring back the old checkout flow",
        "Would love to see more size options",
        # Mixed
        "Good product but shipping was slow",
        "Love the item, hate the packaging",
        "Great quality but customer service needs work",
        # Complaint (ambiguous with other categories)
        "I'm very unhappy with my experience",
        "This has been a frustrating process",
        "Not satisfied at all",
    ],

    "other": [
        # General
        "Hi, I have a question",
        "Hello?",
        "Is anyone there?",
        "I need help",
        # Spam-like
        "Interested in partnership opportunity?",
        "Can I speak to someone about advertising?",
        "Media inquiry regarding your company",
        # Random
        "What time do you close?",
        "Where is your office located?",
        "Do you have a phone number I can call?",
        "I'm looking for a job at your company",
        # Extremely vague
        "...",
        "???",
        "help",
        "urgent",
        # Multi-topic (hard to classify)
        "I want to return my order but also change my password and ask about a charge",
        "Question about my order and also the website is down",
        "Need help with my account and also where's my package",
    ],
}

# Modifiers to make tickets more challenging
PREFIXES = [
    "", "", "", "",  # Most have no prefix
    "Hi, ",
    "Hello, ",
    "Hey, ",
    "Hi there, ",
    "Good morning, ",
    "URGENT: ",
    "Please help - ",
    "Quick question: ",
    "I need help. ",
    "Not sure if this is the right place but ",
    "I've tried everything and ",
    "This is my 3rd time contacting you. ",
    "As I mentioned in my previous email, ",
]

SUFFIXES = [
    "", "", "", "",  # Most have no suffix
    " Thanks.",
    " Thanks!",
    " Please help.",
    " Please advise.",
    " Appreciate your help.",
    " This is urgent.",
    " Need this resolved ASAP.",
    " Waiting for your response.",
    " Let me know.",
    "???",
    "!!!!",
    " - John",
    " Best regards, Customer",
]

TYPO_VARIANTS = {
    "please": ["plz", "pls", "pleas", "pleasee"],
    "help": ["hlp", "halp", "hepl"],
    "order": ["ordr", "oder", "ordor"],
    "account": ["acount", "accout", "acct"],
    "password": ["pasword", "passwrod", "pw", "passwd"],
    "received": ["recieved", "recived", "got"],
    "charged": ["chraged", "chargd", "billed"],
    "refund": ["refnd", "refound", "money back"],
    "return": ["retrun", "retrn", "send back"],
    "shipping": ["shiping", "shippin", "delivery"],
    "cancel": ["cancle", "cancell", "stop"],
    "working": ["workng", "workin", "wrking"],
    "thanks": ["thx", "thnks", "ty"],
    "the": ["teh", "th"],
    "you": ["u", "ya", "yall"],
    "your": ["ur", "yor"],
    "I": ["i"],
    "because": ["bc", "cuz", "cause"],
    "and": ["&", "n"],
    "what": ["wat", "wut", "whats"],
}

def apply_typos(text, probability=0.15):
    """Randomly apply typos to text."""
    if random.random() > probability:
        return text
    words = text.split()
    for i, word in enumerate(words):
        lower = word.lower().strip(".,!?")
        if lower in TYPO_VARIANTS and random.random() < 0.3:
            replacement = random.choice(TYPO_VARIANTS[lower])
            words[i] = word.lower().replace(lower, replacement)
    return " ".join(words)

def apply_case_variation(text):
    """Randomly change case."""
    r = random.random()
    if r < 0.05:
        return text.upper()
    elif r < 0.15:
        return text.lower()
    return text

def generate_ticket():
    """Generate a single ticket."""
    category = random.choice(list(TEMPLATES.keys()))
    template = random.choice(TEMPLATES[category])

    # Fill in template variables
    text = template.format(
        amount=random.randint(20, 500),
        lower_amount=random.randint(10, 200),
        order_id=random.randint(100000, 999999),
        error_code=random.choice(["ERR_500", "PAYMENT_FAILED", "TIMEOUT", "403 Forbidden", "null"]),
    )

    # Apply modifications
    text = random.choice(PREFIXES) + text + random.choice(SUFFIXES)
    text = apply_typos(text)
    text = apply_case_variation(text)

    # Occasionally add extra context that makes classification harder
    if random.random() < 0.1:
        extra = random.choice([
            " Also, ",
            " By the way, ",
            " And another thing: ",
            " PS: ",
        ])
        other_category = random.choice([c for c in TEMPLATES.keys() if c != category])
        other_template = random.choice(TEMPLATES[other_category])
        extra_text = other_template.format(
            amount=random.randint(20, 500),
            lower_amount=random.randint(10, 200),
            order_id=random.randint(100000, 999999),
            error_code="ERROR",
        )
        text += extra + extra_text

    return text

def main():
    tickets = [generate_ticket() for _ in range(1000)]

    with open("sample_tickets_hard.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["text"])
        for ticket in tickets:
            writer.writerow([ticket])

    print(f"Generated 1000 tickets to sample_tickets_hard.csv")
    print("\nSample tickets:")
    for t in random.sample(tickets, 10):
        print(f"  - {t[:80]}...")

if __name__ == "__main__":
    main()
