package org.camunda.bpm.demo.executify;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;

import org.camunda.bpm.model.dmn.Dmn;
import org.camunda.bpm.model.xml.ModelInstance;

public class Executify {

  private boolean generatePredictableConditionExpressions = true;
  private boolean removeDecisionRefs;
  private boolean allProcessesExecutable;

  public HashMap<String, ExecutableModel> makeExecutable(Map<String, InputStream> models) {
    HashMap<String,ExecutableModel> executableModels = new HashMap<String, ExecutableModel>();
    BpmnExecutifier bpmnExecutifier = new BpmnExecutifier();
    bpmnExecutifier.setGeneratePredictableConditionExpressions(isGeneratePredictableConditionExpressions());
    bpmnExecutifier.setRemoveDecisionRefs(removeDecisionRefs);
    bpmnExecutifier.setAllProcessesExecutable(allProcessesExecutable);
    bpmnExecutifier.setExecutableModels(executableModels);
    CmmnExecutifier cmmnExecutifier = new CmmnExecutifier();
    cmmnExecutifier.setGeneratePredictableConditionExpressions(isGeneratePredictableConditionExpressions());
    cmmnExecutifier.setRemoveDecisionRefs(removeDecisionRefs);
    cmmnExecutifier.setExecutableModels(executableModels);
    for (Entry<String, InputStream> entry : models.entrySet()) {
      String filename = entry.getKey();
      InputStream stream = entry.getValue();
      ModelInstance modelInstance;
      if (filename.endsWith(".bpmn")) {
        modelInstance = bpmnExecutifier.executify(stream);
      } else if (filename.endsWith(".cmmn")) {
        modelInstance = cmmnExecutifier.executify(stream);
      } else if (filename.endsWith(".dmn")) {
        modelInstance = Dmn.readModelFromStream(stream);
      } else {
        throw new UnsupportedOperationException("Only *.bpmn, *.cmmn and *.dmn files are supported.");
      }
      executableModels.put(filename, new ExecutableModel(filename, modelInstance));
    }
    return executableModels;
  }

  public boolean isGeneratePredictableConditionExpressions() {
    return generatePredictableConditionExpressions;
  }

  public void setGeneratePredictableConditionExpressions(boolean generatePredictableConditionExpressions) {
    this.generatePredictableConditionExpressions = generatePredictableConditionExpressions;
  }

  public boolean isRemoveDecisionRefs() {
    return removeDecisionRefs;
  }
  
  public void setRemoveDecisionRefs(boolean removeDecisionRefs) {
    this.removeDecisionRefs = removeDecisionRefs;
  }

  public void setAllProcessesExecutable(boolean allProcessesExecutable) {
    this.allProcessesExecutable = allProcessesExecutable;
  }

}
