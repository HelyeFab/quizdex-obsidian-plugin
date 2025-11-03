# 🎮 QuizDex

<div align="center">

![Pikachu](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png)
![Eevee](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png)
![Bulbasaur](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png)

**Turn studying into a Pokémon adventure!**

Generate AI-powered quizzes from your notes, catch Pokémon with perfect scores, and build your ultimate study Pokédex.

**Gotta learn 'em all!** ⚡

[![Support](https://img.shields.io/badge/Support-Buy%20Me%20A%20Pizza-orange?style=for-the-badge&logo=buy-me-a-coffee)](https://www.buymeacoffee.com/YbEwc5qvHT)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Obsidian](https://img.shields.io/badge/Obsidian-Plugin-purple?style=for-the-badge&logo=obsidian)](https://obsidian.md)

</div>

---

## ✨ Features

### 🧠 AI-Powered Quiz Generation
- Generate quizzes from your Obsidian notes using AI
- Support for **Ollama** (local) and **OpenAI** (cloud)
- Multiple question types: Multiple Choice, True/False
- Customizable difficulty levels: Easy, Medium, Hard
- Choose number of questions (5-50)

### 🎮 Pokémon Challenge System
- **Catch Pokémon** by scoring 100% on quizzes!
- Build your personal **study Pokédex**
- Each quiz features a random wild Pokémon encounter
- Track which Pokémon you've caught

### 📚 Quiz Management
- **Save** quizzes for future practice
- **Load** previously saved quizzes
- Quizzes stored in `QuizDex/` folder in your vault
- Full quiz history with scores and timestamps

### 💡 Smart Features
- 🔄 Dynamic loading messages during generation
- 📊 Detailed results with explanations
- 🎯 Review incorrect answers
- ⚡ Quick access via ribbon icon (QD)
- Scrollable UI for all screen sizes

---

## 🚀 Quick Start

### Installation

1. **Community Plugins** (Coming Soon)
   - Open Settings → Community plugins
   - Browse for "QuizDex"
   - Click Install

2. **Manual Installation**
   ```bash
   cd /path/to/your/vault/.obsidian/plugins
   git clone https://github.com/HelyeFab/quizdex-obsidian-plugin.git quizdex
   cd quizdex
   npm install
   npm run build
   ```

3. **Enable the plugin**
   - Open Settings → Community plugins
   - Enable QuizDex

### Setup

1. **Configure AI Provider**
   - Open Settings → QuizDex
   - Choose your provider (Ollama or OpenAI)
   - For Ollama: Ensure it's running locally at `http://localhost:11434`
   - For OpenAI: Enter your API key (will be encrypted)

2. **Generate Your First Quiz**
   - Click the **QD** icon in the sidebar
   - Select notes to quiz from
   - Configure quiz options
   - Start learning!

---

## 🎯 How to Use

### Generating a Quiz

1. **Click the QD icon** in the left sidebar

2. **Select your notes** - Choose which notes to generate questions from

3. **Configure quiz options:**
   - Number of questions (5-50)
   - Difficulty level (Easy/Medium/Hard)
   - Question types (Multiple Choice, True/False)
   - AI model (optional override)

4. **Start the quiz!** 🎮

#### ⚡ Speed Tips for Local Models (Ollama)
- Open **Settings → QuizDex → Ollama** and tune the new *Prompt Character Limit* to something that matches your typical note size (smaller limits keep generations snappy while still capturing the essentials).
- Set *Keep Alive (seconds)* so Ollama keeps the model warm between runs—60‑300 seconds is a good starting point.
- Use a capable *instruction-tuned* model such as `llama3`, `mistral`, or `qwen2.5` for reliable quiz generation. Avoid very small models (<4B parameters) as they struggle with structured JSON output.

### Catching Pokémon

<div align="center">

![Charmander](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png)
![Squirtle](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png)
![Pikachu](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png)
![Jigglypuff](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/39.png)
![Meowth](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/52.png)
![Psyduck](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/54.png)

</div>

When you start a quiz, a **wild Pokémon appears!**

**To catch it:**
- Score **100%** on the quiz
- The Pokémon is added to your Pokédex
- View your collection anytime in the welcome screen

**Challenge yourself** to catch 'em all while mastering your study material!

---

## 🤖 Supported AI Providers

### Ollama (Local) - Recommended ✅
- **Free and private**
- Runs on your machine
- No API key required
- Fast response times
- Models: llama3.1:8b, mistral, etc.

**Setup:**
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama3.1:8b

# Start Ollama (runs automatically)
ollama serve
```

> 💡 Place the premium **Pokemon Go** icon file at `assets/icons/pokemon-go.png` so the plugin can reuse it for the ribbon button and Pokédex launcher.

### OpenAI (Cloud) 🌐
- GPT-4o-mini support
- API key required (encrypted storage)
- Best for complex question generation
- Requires internet connection

**Other providers coming soon:** Anthropic, Google AI, Perplexity, Mistral, Cohere

---

## 📸 Screenshots

### Quiz Generation
The quiz generation modal with customizable options and AI model selection.

### Pokémon Challenge
Wild Pokémon encounters during quizzes - score 100% to catch them!

### Your Pokédex
Track all the Pokémon you've caught by acing your quizzes.

### Quiz Results
Detailed results showing correct/incorrect answers with explanations.

---

## 🛠️ Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/HelyeFab/quizdex-obsidian-plugin.git
cd quizdex-obsidian-plugin

# Install dependencies
npm install

# Build the plugin
npm run build

# Development mode (auto-rebuild on changes)
npm run dev

# Run tests
npm test
```

### Project Structure

```
quizdex/
├── src/
│   ├── main.ts                  # Plugin entry point
│   ├── security/                # API key encryption
│   ├── services/                # AI providers & orchestrator
│   ├── ui/                      # Modals and settings
│   ├── types/                   # TypeScript types
│   └── tests/                   # Unit tests
├── assets/icons/                # UI artwork (e.g., pokemon-go.png)
├── styles.css                   # Plugin styles
├── manifest.json                # Plugin metadata
└── main.js                      # Compiled output
```

---

## 🔐 Security

QuizDex takes your privacy seriously:

- ✅ **Encrypted API keys** using AES-256-GCM
- ✅ **Passphrase-protected** credential storage
- ✅ **Local-first** option with Ollama
- ✅ **No telemetry** or data collection
- ✅ **Open source** - audit the code yourself

See [SECURITY.md](SECURITY.md) for detailed security information.

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. 🐛 **Report bugs** - Open an issue with details
2. 💡 **Suggest features** - Share your ideas
3. 🔧 **Submit PRs** - Fix bugs or add features
4. 📖 **Improve docs** - Help others understand
5. ⭐ **Star the repo** - Show your support!

---

## 📝 Roadmap

### Coming Soon
- [ ] More AI providers (Anthropic, Google AI, Mistral, Cohere)
- [ ] Fill-in-the-blank questions
- [ ] Spaced repetition algorithm
- [ ] Quiz statistics and analytics
- [ ] Export quizzes to Anki
- [ ] Shared Pokédex leaderboard
- [ ] Custom Pokémon sprites

### Ideas
- [ ] Flashcard mode
- [ ] Team building (assemble your dream team!)
- [ ] Evolution chains (unlock evolutions with streaks)
- [ ] Shiny Pokémon (rare variants for perfect scores)

---

## 💖 Support

If QuizDex helps you ace your studies, consider supporting development:

[![Buy Me A Pizza](https://img.shields.io/badge/Buy%20Me%20A%20Pizza-%F0%9F%8D%95-orange?style=for-the-badge)](https://www.buymeacoffee.com/YbEwc5qvHT)

Every pizza slice helps! 🍕⚡

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

---

## 🙏 Acknowledgments

- [Obsidian](https://obsidian.md) - The best knowledge base app
- [PokéAPI](https://pokeapi.co) - Pokémon data and sprites
- [Ollama](https://ollama.ai) - Local LLM runtime
- [Pokemon Go icon](https://www.flaticon.com/free-icon/pokemon-go_1408992) by [Freepik](https://www.freepik.com) – licensed via Flaticon Attribution License
- The Pokémon Company - For creating the amazing Pokémon universe
- All contributors and users ❤️

---

<div align="center">

![Mewtwo](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png)

**Made with ❤️ for students and Pokémon trainers**

[Report Bug](https://github.com/HelyeFab/quizdex-obsidian-plugin/issues) • [Request Feature](https://github.com/HelyeFab/quizdex-obsidian-plugin/issues) • [Star on GitHub](https://github.com/HelyeFab/quizdex-obsidian-plugin)

</div>
