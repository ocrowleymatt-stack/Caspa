import React, {useState} from 'react';

export const CASPA_PROMPT_GUIDE = [
 {group:'Explore',label:'Brainstorm freely',prompt:'What if we changed the ending? Explore possibilities without drafting.',description:'Discuss anything. The manuscript stays untouched.'},
 {group:'Explore',label:'See saved material',prompt:'Show me my saved stories, notes and unused ideas.',description:'Find material from your creative library.'},
 {group:'Explore',label:'Find a forgotten idea',prompt:'Find everything we discussed about Phin and the church.',description:'Search by character, topic or ordinary language.'},
 {group:'Create',label:'Write a short story',prompt:'/story Write a 1,500-word short story about Phin discovering something odd in the vestry.',description:'Creates a separate story candidate for the Story Bank.'},
 {group:'Create',label:'Draft a chapter',prompt:'/draft chapter 7',description:'Explicitly requests a manuscript draft candidate.'},
 {group:'Create',label:'Draft the whole book',prompt:'/draft whole-book',description:'Starts a whole-book drafting request; never silently approves it.'},
 {group:'Create',label:'Plan a series',prompt:'Plan a trilogy with a shared story arc, individual endings and continuity rules.',description:'Produces planning proposals, not manuscript edits.'},
 {group:'Review',label:'Try stitching a story',prompt:'/stitch story-014 into Lemonade between chapters 8 and 9',description:'Proposes an insertion and continuity review.'},
 {group:'Review',label:'Run the DOH audit',prompt:'Run a DOH audit across this book and the connected series.',description:'Find obvious and subtle continuity, timeline and production mistakes.'},
 {group:'Review',label:'Approve a candidate',prompt:'/approve draft_123',description:'Approves one specific candidate; requires its actual ID.'},
 {group:'Review',label:'Reject a candidate',prompt:'/reject draft_123',description:'Rejects one specific candidate without changing the book.'},
 {group:'Controls',label:'Brainstorming mode',prompt:'/spitball',description:'Switch to free exploration.'},
 {group:'Controls',label:'Planning mode',prompt:'/plan',description:'Switch to planning without drafting.'}
] as const;

export interface CaspaPromptGuideProps {onUsePrompt?:(prompt:string)=>void}
/** Mount in LibreChat via its custom UI extension, or embed in CASPA Studio. */
export function CaspaPromptGuide({onUsePrompt}:CaspaPromptGuideProps){
 const [open,setOpen]=useState(false);
 const [filter,setFilter]=useState('');
 const visible=CASPA_PROMPT_GUIDE.filter(item=>(item.label+' '+item.prompt+' '+item.description).toLowerCase().includes(filter.toLowerCase()));
 return <aside aria-label="CASPA prompt guide" style={{fontFamily:'inherit',maxWidth:540}}>
  <button type="button" onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls="caspa-prompt-guide-panel" style={{padding:'10px 14px',borderRadius:10,border:'1px solid currentColor',cursor:'pointer',background:'transparent',color:'inherit'}}>📖 CASPA Idiot's Guide {open?'▴':'▾'}</button>
  {open&&<div id="caspa-prompt-guide-panel" style={{padding:16,border:'1px solid #8885',borderRadius:12,marginTop:8,maxHeight:'65vh',overflowY:'auto'}}>
   <strong>Talk normally. Nothing is drafted unless you type /draft or /story.</strong>
   <p style={{fontSize:13}}>Auto-organise is the recommended default. Approving a candidate is separate from drafting it. Examples containing IDs must use your real candidate or story ID.</p>
   <label htmlFor="caspa-guide-filter">Find a prompt</label>
   <input id="caspa-guide-filter" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search commands and examples" style={{display:'block',width:'100%',padding:8,margin:'8px 0 12px',boxSizing:'border-box'}}/>
   {visible.map(item=><div key={item.label} style={{padding:'10px 0',borderTop:'1px solid #8884'}}>
    <strong>{item.label}</strong><div style={{fontSize:12,opacity:.75}}>{item.description}</div>
    <code style={{display:'block',whiteSpace:'pre-wrap',overflowWrap:'anywhere',margin:'6px 0'}}>{item.prompt}</code>
    <button type="button" onClick={()=>onUsePrompt?onUsePrompt(item.prompt):navigator.clipboard?.writeText(item.prompt)}>{onUsePrompt?'Use prompt':'Copy prompt'}</button>
   </div>)}
   {!visible.length&&<p>No matching prompts.</p>}
  </div>}
 </aside>;
}
