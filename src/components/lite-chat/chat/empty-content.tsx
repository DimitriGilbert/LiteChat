import { MessageSquarePlusIcon } from "lucide-react";

export const EmptyContent = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center pt-36 px-4">
      <div className="rounded-full bg-muted p-5 mb-5">
        <MessageSquarePlusIcon className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-medium mb-3 text-foreground">
        Welcome to LiteChat ⚡️
      </h3>
      <p className="text-sm text-muted-foreground max-w-xl mb-4">
        Your OpenSource, local, lightweight AI chat experience that lives right
        in your browser. No servers(ish), no tracking, just conversations.
      </p>
      <div className="bg-card/80 p-5 rounded-lg border border-border text-left max-w-[1600px] mb-6">
        <h4 className="font-medium text-card-foreground mb-2 flex items-center">
          <span className="text-yellow-400 mr-2">💡</span> A little backstory...
        </h4>
        <p className="text-sm text-card-foreground mb-3 italic">
          "I created LiteChat because I wanted a better experience for my local
          AI chats that I couldn't get with{" "}
          <a
            href="https://t3.chat"
            className="text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            T3.chat
          </a>{" "}
          (and everything else seemed clunky...) . Then I added things I thought
          were missing, like a virtual file system and projects to organize
          chats. And I have more features planned! (Soon, tm) :wink-wink:"
        </p>
        <p className="text-sm text-card-foreground mb-3 italic">
          If you need a professional chat app that will be kept up to date, you
          should really consider{" "}
          <a
            href="https://t3.chat"
            className="text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            T3.chat
          </a>
        </p>
        <p className="text-sm text-card-foreground mb-3 italic">
          {" "}
          LiteChat is a cool experiment but I wouldn't recommend you to use it
          for serious purposes if you are not (at least in part) a dev
          (#ChatAppsAreHard).
        </p>
        <p className="text-xs text-muted-foreground">
          That said, LiteChat gives you complete privacy and control –
          everything stays in your browser, well, at least no one between you
          and your favorite AI provider.
        </p>
      </div>
      <div className="bg-card/80 p-5 rounded-lg border border-border text-left max-w-[1600px] mb-6">
        <h4 className="font-medium text-card-foreground mb-3 flex items-center">
          <span className="text-blue-400 mr-2">🔑</span> Bring Your Own API Key
        </h4>
        <p className="text-sm text-card-foreground mb-3">
          LiteChat puts you in control of your AI experience. Add your own API
          keys and chat with your favorite models.
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          LiteChat was lovingly vibe coded with additional features to make your
          AI conversations feel more... Naaaahhh XD, I wanted my own wheel !
        </p>
        <p className="text-xs text-muted-foreground mb-3 text-center">
          Damn AI BullSlope XD !
        </p>
        <div className="bg-muted/50 p-3 rounded-md mb-3">
          <p className="text-xs font-medium text-card-foreground mb-2">
            To get started, add your API key in settings:
          </p>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <a
              href="https://openrouter.ai/keys"
              className="text-blue-400 hover:underline flex items-center"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="mr-1">→</span> OpenRouter API Keys (Many models
              in one place)
            </a>
            <a
              href="https://platform.openai.com/account/api-keys"
              className="text-blue-400 hover:underline flex items-center"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="mr-1">→</span> OpenAI API Keys (GPT models)
            </a>
            <a
              href="https://console.anthropic.com/keys"
              className="text-blue-400 hover:underline flex items-center"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="mr-1">→</span> Anthropic API Keys (Claude models)
            </a>
          </div>
          <p className="text-xs text-muted-foreground mb-3 italic pt-4">
            Don't worry, your keys are stored in your browser and never sent to
            any server except the AI provider you choose.
          </p>
        </div>
        <p className="text-sm text-card-foreground mb-3 italic">
          Then you need to configure your provider(s) (I remember someone saying
          something about clunky...)
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Or maybe run one locally (
          <a
            href="https://ollama.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            Ollama
          </a>{" "}
          or{" "}
          <a
            href="https://lmstudio.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            LMStudio
          </a>
          )
        </p>
        <p className="text-sm text-card-foreground mb-3 italic">
          Aaaand then, ..., you are good to go, just chat your brains out !
        </p>
      </div>
      <div className="bg-card/80 p-5 rounded-lg border border-border text-left max-w-[1600px] mb-6">
        <h4 className="font-medium text-card-foreground mb-2 flex items-center">
          <span className="text-green-400 mr-2">✨</span> What makes LiteChat
          special?
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="bg-muted/50 p-3 rounded-md transition-all hover:scale-105">
            <p className="font-medium text-card-foreground mb-1">
              Virtual File System
            </p>
            <p className="text-xs text-muted-foreground">
              Upload and manage files for your AI to reference
            </p>
            <p className="text-xs text-muted-foreground">
              Now with (limited) support for Git !! Clone, pull, all that good
              stuff :D
            </p>
          </div>
          <div className="bg-muted/50 p-3 rounded-md transition-all hover:scale-105">
            <p className="font-medium text-card-foreground mb-1">
              Projects & Folders
            </p>
            <p className="text-xs text-muted-foreground">
              Organize your chats by topic or purpose
            </p>
            <p className="text-xs text-muted-foreground">
              Synchronize you conversation using Git (no tried yet, but my
              issues are open :D)
            </p>
          </div>
          <div className="bg-muted/50 p-3 rounded-md transition-all hover:scale-105">
            <p className="font-medium text-card-foreground mb-1">
              Chat parameters control
            </p>
            <p className="text-xs text-muted-foreground">
              System prompt, Temperature, Top Somethings, Penalty(ies) !
            </p>
          </div>
          <div className="bg-muted/50 p-3 rounded-md transition-all hover:scale-105">
            <p className="font-medium text-card-foreground mb-1">
              Chat parameters control
            </p>
            <p className="text-xs text-muted-foreground">
              System prompt, Temperature, Top Somethings, Penalty(ies) !
            </p>
          </div>
          <div className="bg-muted/50 p-3 rounded-md transition-all hover:scale-105">
            <p className="font-medium text-card-foreground mb-1">Mods !</p>
            <p className="text-xs text-muted-foreground">
              I didn't try modding (yet), but I'm pretty sure you could do cool
              things :D.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
