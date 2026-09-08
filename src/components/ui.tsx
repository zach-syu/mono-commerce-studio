import { Children, cloneElement, createContext, isValidElement, useContext, useId } from 'react';
import type { ButtonHTMLAttributes, ChangeEvent, ComponentProps, CompositionEvent, CSSProperties, FocusEventHandler, HTMLAttributes, InputHTMLAttributes, KeyboardEvent, MouseEvent, ReactElement, ReactNode, Ref, SelectHTMLAttributes } from 'react';
// Import shipped ESM components directly: the package barrel eagerly loads unrelated legacy date/chart code.
import PitayaButton from '@cyberbiz-corp/pitaya-ui/dist/components/pitayas/PitayaButton.js';
import PitayaCheckbox from '@cyberbiz-corp/pitaya-ui/dist/components/pitayas/PitayaCheckbox.js';
import PitayaInput from '@cyberbiz-corp/pitaya-ui/dist/components/pitayas/PitayaInput.js';
import PitayaRoundBox from '@cyberbiz-corp/pitaya-ui/dist/components/pitayas/PitayaRoundBox.js';
import PitayaSelect from '@cyberbiz-corp/pitaya-ui/dist/components/pitayas/PitayaSelect.js';
import { AlertCircle, Check } from 'lucide-react';
const PendingContext=createContext(false);
export function BusyScope({disabled,children}:{disabled:boolean;children:ReactNode}){return <PendingContext.Provider value={disabled}><fieldset className="editor-fieldset" disabled={disabled}>{children}</fieldset></PendingContext.Provider>;}

export function Button({children,variant='primary',className='',onClick,value,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'ghost'}){
 const pending=useContext(PendingContext);
 return <PitayaButton {...props} disabled={props.disabled||pending} value={value===undefined?undefined:String(value)} buttonState={variant==='primary'?'primary':'secondary'} buttonSize="large" className={`button ${variant} ${className}`} onClick={event=>onClick?.(event as unknown as MouseEvent<HTMLButtonElement>)}>{children}</PitayaButton>;
}
export function Input({type='text',size:_size,className='',onKeyDown,onCompositionStart,onCompositionEnd,spellCheck,defaultValue,value,...props}:InputHTMLAttributes<HTMLInputElement>){
 const pending=useContext(PendingContext);
 return <PitayaInput {...props} disabled={props.disabled||pending} spellCheck={spellCheck===undefined?undefined:spellCheck===true||spellCheck==='true'} className={`mono-input ${className}`} inputType={type as ComponentProps<typeof PitayaInput>['inputType']} inputSize="large" value={Array.isArray(value)?value.join(','):value as string|number|undefined} defaultValue={defaultValue===undefined?undefined:String(defaultValue)} onKeyDown={event=>onKeyDown?.(event as KeyboardEvent<HTMLInputElement>)} onCompositionStart={event=>onCompositionStart?.(event as CompositionEvent<HTMLInputElement>)} onCompositionEnd={event=>onCompositionEnd?.(event as CompositionEvent<HTMLInputElement>)}/>;
}
interface SelectPartProps {
 children?:ReactNode;id?:string;innerRef?:Ref<HTMLInputElement>;isDisabled?:boolean;isSelected?:boolean;isFocused?:boolean;value?:string;tabIndex?:number;
 onBlur?:FocusEventHandler<HTMLInputElement>;onFocus?:FocusEventHandler<HTMLInputElement>;onChange?:InputHTMLAttributes<HTMLInputElement>['onChange'];
 'aria-label'?:string;selectProps:{menuIsOpen?:boolean;inputId:string;'aria-describedby'?:string};
 innerProps?:HTMLAttributes<HTMLDivElement>;getStyles:(part:string,props:unknown)=>CSSProperties;
}
function SelectInputPart(props:SelectPartProps){return <input ref={props.innerRef} id={props.id} className="mono-select-native-input" type="text" autoComplete="off" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={!!props.selectProps.menuIsOpen} aria-controls={props.selectProps.menuIsOpen?`${props.selectProps.inputId}-listbox`:undefined} aria-label={props['aria-label']} aria-describedby={props.selectProps['aria-describedby']} disabled={props.isDisabled} value={props.value} onBlur={props.onBlur} onFocus={props.onFocus} onChange={props.onChange} tabIndex={props.tabIndex}/>;}
function SelectOptionPart(props:SelectPartProps){return <div {...props.innerProps} ref={props.innerRef as Ref<HTMLDivElement>} role="option" aria-selected={props.isSelected} aria-disabled={props.isDisabled} className={`pitaya-select__option ${props.isSelected?'pitaya-select__option--is-selected':''}`} style={props.getStyles('option',props)}>{props.children}</div>;}
function SelectMenuPart(props:SelectPartProps){return <div {...props.innerProps} ref={props.innerRef as Ref<HTMLDivElement>} id={`${props.selectProps.inputId}-listbox`} role="listbox" style={props.getStyles('menuList',props)} className="pitaya-select__menu-list">{props.children}</div>;}

// The application keeps its existing string settings; this adapter owns react-select's option shape.
export function Select({children,value,onChange,className='',id,disabled,name,...props}:SelectHTMLAttributes<HTMLSelectElement>){
 const generatedId=useId();const inputId=id||generatedId;const pending=useContext(PendingContext);
 const options=Children.toArray(children).filter(isValidElement).map(child=>{const option=child as ReactElement<{value?:string;children?:ReactNode;disabled?:boolean}>;const label=String(option.props.children??'');return {label,value:String(option.props.value??label),isDisabled:option.props.disabled};});
 const accessibility={'aria-label':props['aria-label'],'aria-describedby':props['aria-describedby'],inputId};
 return <PitayaSelect {...accessibility} id={`${inputId}-control`} name={name} className={`mono-select ${className}`} options={options} value={options.find(option=>option.value===String(value))??null} disabled={disabled||pending} selectSize="large" isSearchable={true} component={{Input:SelectInputPart,Option:SelectOptionPart,MenuList:SelectMenuPart}} isClearable={false} instanceId={inputId} onChange={option=>{if(option)onChange?.({target:{value:option.value,name},currentTarget:{value:option.value,name}} as ChangeEvent<HTMLSelectElement>);}}/>;
}
export function Checkbox({onChange,className='',children,label,...props}:InputHTMLAttributes<HTMLInputElement>&{label?:ReactNode}){
 const pending=useContext(PendingContext);
 return <PitayaCheckbox {...props} disabled={props.disabled||pending} className={`mono-checkbox ${className}`} inputId={props.id} renderLabel={label??children??<span className="sr-only">{props['aria-label']||'選取'}</span>} onChange={event=>onChange?.(event as unknown as ChangeEvent<HTMLInputElement>)}/>;
}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){
 const generatedId=useId();const child=isValidElement(children)?children as ReactElement<{id?:string;'aria-label'?:string;'aria-describedby'?:string}>:null;const id=child?.props.id||generatedId;
 return <div className="field"><label className="field-label" htmlFor={id}>{label}</label>{child?cloneElement(child,{id,'aria-label':child.props['aria-label']||label,'aria-describedby':hint?`${id}-hint`:child.props['aria-describedby']}):children}{hint&&<small id={`${id}-hint`}>{hint}</small>}</div>;
}
export function Panel({className='',...props}:HTMLAttributes<HTMLDivElement>){return <PitayaRoundBox {...props} className={`mono-panel ${className}`}/>;}
export function Alert({children}:{children:ReactNode}){return <div className="alert" role="alert"><AlertCircle size={18}/><div>{children}</div></div>;}
export function Choice({selected,children,onClick,label}:{selected:boolean;children:ReactNode;onClick:()=>void;label?:string}){const pending=useContext(PendingContext);return <button type="button" disabled={pending} className={`choice ${selected?'selected':''}`} aria-pressed={selected} aria-label={label} onClick={onClick}>{children}<span className="choice-check">{selected&&<Check size={13}/>}</span></button>;}
