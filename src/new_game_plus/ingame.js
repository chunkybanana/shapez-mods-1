import { generateLevelDefinitions } from "game/modes/regular";
import { InGameState } from "states/ingame";

export class NGPInGameState extends InGameState {
    stage4aInitEmptyGame() {
        super.stage4aInitEmptyGame();

        const level = this.creationPayload.startingLevel;
        if (!level) {
            return;
        }

        // register all rewards that would be unlocked
        const rewards = generateLevelDefinitions().map((goal) => goal.reward);
        const gameRewards = this.core.root.hubGoals.gainedRewards;
        for (const reward of rewards) {
            gameRewards[reward] = (gameRewards[reward] || 0) + 1;
        }

        this.core.root.hubGoals.level = level;
        this.core.root.hubGoals.computeNextGoal();
    }
}
