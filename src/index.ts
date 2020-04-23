import { Players, UserInputService, GuiService, RunService } from "@rbxts/services";

interface PlayerControlInterface{
	Disable: Function;
	Enable: Function;
}

//	//CONFIG\\

const CREATE_GUI: boolean = true;								//	Auto creates GUI if set to true, if false, you must change the CursorGui and Cursor variables
const CURSOR_ICON: string = "rbxassetid://4883624920";
const CURSOR_SIZE: UDim2 = new UDim2(0, 15, 0, 15);
const SENSITIVIY: number = 10;
const THUMBSTICK_DEADZONE: number = 0.5;
const THUMBSTICK_KEY: Enum.KeyCode = Enum.KeyCode.Thumbstick1;
const ACTIVATION_KEY: Enum.KeyCode = Enum.KeyCode.ButtonSelect;
const DEFAULT_GAMEPAD: Enum.UserInputType = Enum.UserInputType.Gamepad1;

// VALID_SELECTION_TYPES DECLARATION
const VALID_SELECTION_TYPES: Map<string, boolean> = new Map()
//FILL VALID_SELECTION_TYPES
VALID_SELECTION_TYPES.set("TextButton", true);
VALID_SELECTION_TYPES.set("ImageButton", true);
VALID_SELECTION_TYPES.set("TextBox", true);
VALID_SELECTION_TYPES.set("ScrollingFrame", true);

//	//CONFIG END\\

//Bindable event setup
interface EventsInterface{
	CursorActivated: BindableEvent;
	CursorDeactivated: BindableEvent;
	GuiObjectSelectionStarted: BindableEvent;
	GuiObjectSelectionEnded: BindableEvent;
}
export const Events: EventsInterface = {
	CursorActivated: new Instance("BindableEvent"),
	CursorDeactivated: new Instance("BindableEvent"),
	GuiObjectSelectionStarted: new Instance("BindableEvent"),
	GuiObjectSelectionEnded: new Instance("BindableEvent"),
}

export const CursorActivated: RBXScriptSignal<() => void, true> = Events.CursorActivated.Event;
export const CursorDeactivated: RBXScriptSignal<() => void, true> = Events.CursorDeactivated.Event;
export const GuiObjectSelectionStarted: RBXScriptSignal<() => void, true> = Events.GuiObjectSelectionStarted.Event;
export const GuiObjectSelectionEnded: RBXScriptSignal<() => void, true> = Events.GuiObjectSelectionEnded.Event;

//Player
const Player: Player = Players.LocalPlayer;

//Services / Top Level
const PlayerScripts: PlayerScripts = Player.WaitForChild("PlayerScripts") as PlayerScripts;
const PlayerGui: PlayerGui = Player.WaitForChild("PlayerGui") as PlayerGui;

//Locals
let CursorGui: ScreenGui|undefined;
let Cursor: ImageLabel|undefined;

const states: Map<Enum.KeyCode, InputObject> = new Map()

let isInCursorMode: boolean = false;
let currentPosition: UDim2 = new UDim2(0, 0, 0, 0);
let currentMoveDirection: Vector2 = new Vector2(0, 0);






//Controllers
const PlayerModule = PlayerScripts.WaitForChild("PlayerModule");
const PlayerControl = require(PlayerModule.WaitForChild("ControlModule") as ModuleScript) as PlayerControlInterface;




//Automatically creates the GUI if CREATE_GUI is true
const findCursorGui = PlayerGui.FindFirstChild("GamepadCursor");
if (findCursorGui && findCursorGui.IsA("ScreenGui")){
	warn("GamepadCursor already exists!");
	CursorGui = findCursorGui;
	const findCursor = CursorGui.FindFirstChild("Cursor");
	if (findCursor && findCursor.IsA("ImageLabel"))
		Cursor = findCursor;
}else{
	if (CREATE_GUI === true){
		CursorGui = new Instance("ScreenGui");
		CursorGui.Parent = PlayerGui;
		CursorGui.Name = "GamepadCursor";
		CursorGui.DisplayOrder = 999999999;
		CursorGui.ResetOnSpawn = true;
		CursorGui.ZIndexBehavior = Enum.ZIndexBehavior.Global;

		Cursor = new Instance("ImageLabel");
		Cursor.Parent = CursorGui;
		Cursor.Visible = false;
		Cursor.Name = "Cursor";
		Cursor.AnchorPoint = new Vector2(0.5, 0.5);
		Cursor.BackgroundTransparency = 1;
		Cursor.Size = CURSOR_SIZE;
		Cursor.ZIndex = 999999999;
		Cursor.Image = CURSOR_ICON;
		Cursor.Selectable = false;
	}else{
		const cg = PlayerGui.WaitForChild("GamepadCursor");
		if (cg && cg.IsA("ScreenGui")){
			const c = cg.FindFirstChild("Cursor");
			if (c && c.IsA("ImageLabel")){
				CursorGui = cg;
				Cursor = c;
			}
		}	
	}
}

//--Localize all available inputs for gamepad
for (const [, state] of UserInputService.GetGamepadState(DEFAULT_GAMEPAD).entries()) {
	states.set(state.KeyCode, state);
}



//	Binds

//Detect changes in user input state
UserInputService.InputBegan.Connect((inputObject)=>{
	if (inputObject.KeyCode === ACTIVATION_KEY){
		isInCursorMode = !isInCursorMode;

		//Show or hide cursor depending on isInCursorMode
		if (isInCursorMode === true){
			ShowCursor();
		}else{
			HideCursor();
		}
	}else if (inputObject.KeyCode === Enum.KeyCode.ButtonR3){
		if (isInCursorMode === true){
			HideCursor();
		}
	}
})

//Hide cursor if input type is changed from GamePad
UserInputService.LastInputTypeChanged.Connect((lastInputType)=>{
	if (lastInputType !== Enum.UserInputType.Gamepad1 && isInCursorMode === true)
		HideCursor();
})

UserInputService.MouseIconEnabled = true;






//	Methods

//Updates the position of the Cursor
function UpdateCursorPosition(){
	if (!Cursor || !CursorGui){warn("CURSOR/CURSORGUI NOT CREATED");return;}

	const leftThumbstick = states.get(THUMBSTICK_KEY);
	if (!leftThumbstick){
		warn("leftThumbstick",leftThumbstick,"not found!");
		return;
	}

	//Update move direction by polling position
	if (leftThumbstick.Position.Magnitude > THUMBSTICK_DEADZONE){
		currentMoveDirection = (new Vector2(leftThumbstick.Position.X, -leftThumbstick.Position.Y).mul(SENSITIVIY).div(CursorGui.AbsoluteSize));
	}else{
		currentMoveDirection = new Vector2();
	}

	//Construct a new UDim2 position
	currentPosition = currentPosition.add(new UDim2(currentMoveDirection.X, 0, currentMoveDirection.Y, 0));

	//Constrain with screen bounds
	currentPosition = new UDim2(math.clamp(currentPosition.X.Scale, 0, 1), 0, math.clamp(currentPosition.Y.Scale, 0, 1), 0);

	//Update position of Cursor
	Cursor.Position = currentPosition;

	//Detect UI at cursor position
	const uiObjects = (PlayerGui.GetGuiObjectsAtPosition(Cursor.AbsolutePosition.X, Cursor.AbsolutePosition.Y) || []);

	//Selects the uppermost, valid object (in case of hidden valid objects)
	let topUiObject;
	for (const [, uiObject] of uiObjects.entries()) {
		if (uiObject && VALID_SELECTION_TYPES.get(uiObject.ClassName) && uiObject.IsA("GuiObject") && uiObject.Selectable){
			topUiObject = uiObject;
			break;
		}
	}

	//Update selectionObject if object exists and is a valid class type
	if (topUiObject){
		//If hot-selecting ui objects, one after another, fire selection ended for old object
		//Fire selection started once
		if (GuiService.SelectedObject){
			if (GuiService.SelectedObject !== topUiObject)
				Events.GuiObjectSelectionEnded.Fire(GuiService.SelectedObject);
		}else{
			Events.GuiObjectSelectionStarted.Fire(topUiObject);
		}

		GuiService.SelectedObject = topUiObject;
	}else{
		//If selected object exists, fire event
		if (GuiService.SelectedObject){
			Events.GuiObjectSelectionEnded.Fire(GuiService.SelectedObject);
		}
		GuiService.SelectedObject = undefined;
	}
}


//	Public Methods

//Shows the cursor, binds to renderStepped to allow cursor movement
export function ShowCursor(){
	if (!Cursor){warn("CURSOR NOT CREATED");return;}
	isInCursorMode = true;

	UserInputService.MouseIconEnabled = false;
	GuiService.GuiNavigationEnabled = false;
	GuiService.AutoSelectGuiEnabled = false;
	Cursor.Visible = true;

	//Disables player movement while selection GUI
	GuiService.SelectedObject = undefined;
	PlayerControl.Disable(PlayerControl);

	//Set position to center of scree for cleanliness
	currentPosition = new UDim2(0.5, 0, 0.5, 0);

	//Fire event and bind UpdateCursorPosition method to renderStepped
	Events.CursorActivated.Fire();
	RunService.BindToRenderStep("CursorUpdate", 1, ()=>{UpdateCursorPosition()});
}


//Hides the cursor, removes renderStepped bind
export function HideCursor(){
	if (!Cursor){warn("CURSOR NOT CREATED");return;}
	isInCursorMode = false;

	UserInputService.MouseIconEnabled = true;
	GuiService.GuiNavigationEnabled = true;
	GuiService.AutoSelectGuiEnabled = true;
	Cursor.Visible = false;

	//Deselects any selected object, enables player movement
	GuiService.SelectedObject = undefined;
	PlayerControl.Enable(PlayerControl);

	//Fire event, Unbindes UpdateCursorPosition method from renderStepped
	Events.CursorDeactivated.Fire();
	RunService.UnbindFromRenderStep("CursorUpdate");
}