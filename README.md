# Testbed for agentic enablers

In its current incarnation, the focus is to explore various configurations of the latest wave of CLI-clients 
(Claud Code, Gemini CLI, Crush, Qwen Coder etc.) to learn how local client-side tooling can unlock gains in quality and productivity.

The repo is organized in task domains under `/workflows`

## How to use
Clone this repo, then navigate to the desired workflows-directory and start your CLI tool from there.

You will need [Claud Code](https://docs.anthropic.com/en/docs/claude-code/quickstart), or compatible tools

```bash
cd workflows/documentation
claude
```

## Future development
* The initial commit is focused on Digdir and [Altinn docs](https://github.com/Altinn/altinn-studio-docs). 
The plan is to move e.g. the dictionary and the specific writing-guide into the docs repo, and get the agent/tooling to 
use those files, leaving this as a more generic baseline that is better suited to re-use in other scenarios.
 
* In the future, other tooling/models may be explored (other CLI flavours, usage in GitHub workflows directly etc.) 
