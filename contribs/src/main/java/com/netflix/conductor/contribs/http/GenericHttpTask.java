package com.netflix.conductor.contribs.http;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.netflix.conductor.auth.AuthManager;
import com.netflix.conductor.auth.AuthResponse;
import com.netflix.conductor.common.metadata.tasks.Task;
import com.netflix.conductor.common.metadata.tasks.TaskResult;
import com.netflix.conductor.common.run.Workflow;
import com.netflix.conductor.contribs.correlation.Correlator;
import com.netflix.conductor.core.DNSLookup;
import com.netflix.conductor.core.config.Configuration;
import com.netflix.conductor.core.execution.WorkflowExecutor;
import com.netflix.conductor.core.execution.tasks.WorkflowSystemTask;
import com.sun.jersey.api.client.Client;
import com.sun.jersey.api.client.ClientResponse;
import com.sun.jersey.api.client.UniformInterfaceException;
import com.sun.jersey.api.client.WebResource;
import com.sun.jersey.core.util.MultivaluedMapImpl;
import com.sun.jersey.oauth.client.OAuthClientFilter;
import com.sun.jersey.oauth.signature.OAuthParameters;
import com.sun.jersey.oauth.signature.OAuthSecrets;
import org.apache.commons.collections.MapUtils;
import org.apache.commons.lang3.ArrayUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.core.HttpHeaders;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.MultivaluedMap;
import javax.ws.rs.core.Response;
import java.io.IOException;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

class GenericHttpTask extends WorkflowSystemTask {
	private static final Logger logger = LoggerFactory.getLogger(HttpTask.class);
	static final String REQUEST_PARAMETER_NAME = "http_request";
	static final String RESPONSE_PARAMETER_NAME = "http_response";
	static final String STATUS_MAPPING_PARAMETER_NAME = "status_mapping";

	protected Configuration config;
	protected ObjectMapper om;
	private AuthManager auth;
	private RestClientManager rcm;

	private TypeReference<Map<String, Object>> mapOfObj = new TypeReference<Map<String, Object>>() {
	};

	private TypeReference<List<Object>> listOfObj = new TypeReference<List<Object>>() {
	};

	GenericHttpTask(String name, Configuration config, RestClientManager rcm, ObjectMapper om, AuthManager auth) {
		super(name);
		this.config = config;
		this.rcm = rcm;
		this.om = om;
		this.auth = auth;
	}

	String lookup(String service) {
		DNSLookup lookup = new DNSLookup();
		DNSLookup.DNSResponses responses = lookup.lookupService(service);
		if (responses != null && ArrayUtils.isNotEmpty(responses.getResponses())) {
			String address = responses.getResponses()[0].getAddress();
			int port = responses.getResponses()[0].getPort();
			return "http://" + address + ":" + port;
		}
		return null;
	}

	@SuppressWarnings("unchecked")
	HttpResponse httpCallUrlEncoded(Input input, String body) throws Exception {
		Client client = rcm.getClient(input);
		MultivaluedMap formData = new MultivaluedMapImpl();
		Map<String, String> bodyparam = new ObjectMapper().readValue(body, HashMap.class);
		Iterator it = bodyparam.entrySet().iterator();
		while (it.hasNext()) {
			Map.Entry pair = (Map.Entry) it.next();
			formData.add(pair.getKey(), pair.getValue());
			it.remove();
		}
		WebResource webResource = client.resource(input.getUri());

		ClientResponse response = webResource
				.type(MediaType.APPLICATION_FORM_URLENCODED_TYPE)
				.post(ClientResponse.class, formData);

		if (response.getStatus() != 201 && response.getStatus() != 200) {
			throw new RuntimeException("Failed : HTTP error code : "
					+ response.getStatus() + response.getEntity(String.class));
		}
		HttpResponse responsehttp = new HttpResponse();

		responsehttp.body = extractBody(response);
		responsehttp.statusCode = response.getStatus();
		responsehttp.headers = response.getHeaders();
		return responsehttp;

	}

	/**
	 * @param input HTTP Request
	 * @return Response of the http call
	 * @throws Exception If there was an error making http call
	 */
	HttpResponse httpCall(Input input, Task task, Workflow workflow, WorkflowExecutor executor) throws Exception {
		Client client = rcm.getClient(input);

		if (input.getOauthConsumerKey() != null) {
			logger.info("Configuring OAuth filter");
			OAuthParameters params = new OAuthParameters().consumerKey(input.getOauthConsumerKey()).signatureMethod("HMAC-SHA1").version("1.0");
			OAuthSecrets secrets = new OAuthSecrets().consumerSecret(input.getOauthConsumerSecret());
			client.addFilter(new OAuthClientFilter(client.getProviders(), params, secrets));
		}

		WebResource.Builder builder = client.resource(input.getUri()).type(MediaType.APPLICATION_JSON);

		if (input.getBody() != null) {
			builder.entity(input.getBody());
		}

		// Attach the Authorization header by adding entry to the input's headers
		if (input.isAuthorize()) {
			setAuthorization(input);
		}

		// Attach Deluxe Owf Context header
		if (input.isCorrelation()) {
			setCorrelation(input, workflow);
		}

		// Attach headers to the builder
		input.getHeaders().entrySet().forEach(e -> {
			builder.header(e.getKey(), e.getValue());
		});

		// Log the headers
		Map<String, Object> headers = new HashMap<>(input.getHeaders());
		// We need to mask auth header value
		if (headers.containsKey(HttpHeaders.AUTHORIZATION)) {
			headers.put(HttpHeaders.AUTHORIZATION, "xxxxxxxxxxxxxxxxxxx");
		}
		logger.info("http task headers " + headers);

		// Store input headers back to the input request
		if (MapUtils.isNotEmpty(input.getHeaders())) {

			// Escaping the auth
			if (input.getHeaders().containsKey(HttpHeaders.AUTHORIZATION)) {
				input.getHeaders().put(HttpHeaders.AUTHORIZATION, "xxxxxxxxxxxxxxxxxxx");
			}

			task.getInputData().put(REQUEST_PARAMETER_NAME, input);
			executor.updateTask(new TaskResult(task));
		}

		HttpResponse response = new HttpResponse();
		try {
			ClientResponse cr = builder.accept(input.getAccept()).method(input.getMethod(), ClientResponse.class);
			Response.Status.Family family = cr.getStatusInfo().getFamily();
			if (cr.getStatus() != 204 && cr.hasEntity() && !family.equals(Response.Status.Family.REDIRECTION)) {
				response.body = extractBody(cr);
			}
			response.statusCode = cr.getStatus();
			response.headers = cr.getHeaders();
			return response;
		} catch (UniformInterfaceException ex) {
			logger.error(ex.getMessage(), ex);
			ClientResponse cr = ex.getResponse();
			logger.error("Status Code: {}", cr.getStatus());
			if (cr.getStatus() > 199 && cr.getStatus() < 300) {
				if (cr.getStatus() != 204 && cr.hasEntity()) {
					response.body = extractBody(cr);
				}
				response.headers = cr.getHeaders();
				response.statusCode = cr.getStatus();
				return response;
			} else {
				String reason = cr.getEntity(String.class);
				logger.error(reason, ex);
				throw new Exception(reason);
			}
		}
	}

	private Object extractBody(ClientResponse cr) {
		String json = cr.getEntity(String.class);
		try {
			JsonNode node = om.readTree(json);
			if (node.isArray()) {
				return om.convertValue(node, listOfObj);
			} else if (node.isObject()) {
				return om.convertValue(node, mapOfObj);
			} else if (node.isNumber()) {
				return om.convertValue(node, Double.class);
			} else {
				return node.asText();
			}

		} catch (IOException jpe) {
			logger.error(jpe.getMessage(), jpe);
			return json;
		}
	}

	@SuppressWarnings("unchecked")
	private void setCorrelation(Input input, Workflow workflow) throws JsonProcessingException {
		if (workflow.getCorrelationId() != null) {
			Correlator correlator = new Correlator(logger, workflow.getCorrelationId());
			correlator.attach(input.getHeaders());
		}
	}

	private void setAuthorization(Input input) throws Exception {
		AuthResponse response = auth.authorize();
		input.getHeaders().put(HttpHeaders.AUTHORIZATION, "Bearer " + response.getAccessToken());
	}

	@SuppressWarnings("unchecked")
	boolean handleStatusMapping(Task task, HttpResponse response) {
		Object param = task.getInputData().get(STATUS_MAPPING_PARAMETER_NAME);
		if (param == null) {
			return false;
		}
		if (!(param instanceof Map)) {
			throw new RuntimeException("The " + STATUS_MAPPING_PARAMETER_NAME + " is not an object");
		}
		Map<Integer, Task.Status> statusMapping = om.convertValue(param, new TypeReference<Map<Integer, Task.Status>>() {
		});
		if (statusMapping.isEmpty()) {
			return false;
		}

		Task.Status taskStatus = statusMapping.get(response.statusCode);
		if (taskStatus == null) {
			return false;
		}

		task.setStatus(taskStatus);
		return true;
	}
}